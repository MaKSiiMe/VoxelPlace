'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic            from 'next/dynamic'
import { Hud }            from '@features/hud/components/Hud'
import { useSocket }      from '@features/realtime/hooks/useSocket'
import { useCanvasStore } from '@features/canvas/store'
import { useAuthStore }   from '@features/auth/store'
import { Toaster }        from '@features/notifications/components/Toaster'
import { notify }         from '@features/notifications/store'
import { useSocketNotifications } from '@features/notifications/hooks/useSocketNotifications'
import { parsePixelLink } from '@features/canvas/pixelLink'
import { navigateToPixel } from '@features/canvas/viewportState'

const CanvasEngine = dynamic(
  () => import('@features/canvas/components/CanvasEngine').then(m => ({ default: m.CanvasEngine })),
  { ssr: false }
)
const AuthDialog = dynamic(
  () => import('@features/auth/components/AuthDialog').then(m => ({ default: m.AuthDialog })),
  { ssr: false }
)
const PixelInspector = dynamic(
  () => import('@features/canvas/components/PixelInspector').then(m => ({ default: m.PixelInspector })),
  { ssr: false }
)

export default function GamePage() {
  const [showModal,     setShowModal]     = useState(false)
  const [effectiveUser, setEffectiveUser] = useState('')

  const viewerIdRef = useRef(`viewer_${Math.random().toString(36).slice(2, 6)}`)

  const { username, role, login, logout, loadFromStorage } = useAuthStore()
  const setRole = useCanvasStore((s) => s.setRole)

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  // Détermine le nom effectif une fois localStorage chargé
  useEffect(() => {
    setEffectiveUser(username || viewerIdRef.current)
  }, [username])

  // Synchronise le rôle auth → canvas store
  useEffect(() => {
    setRole(role)
  }, [role, setRole])

  useSocket(effectiveUser)
  useSocketNotifications()
  useLinkedPixel()

  if (!effectiveUser) return null

  // La déconnexion ouvrait d'office la fenêtre de connexion, qui ne se fermait
  // pas : on ne pouvait plus simplement regarder la toile.
  function handleLogout() {
    logout()
    notify({ kind: 'info', message: 'Tu es déconnecté. Tu peux continuer à regarder la toile.' })
  }

  return (
    <main className="w-screen h-screen overflow-hidden">
      <h1 className="sr-only">VoxelPlace — Canvas collaboratif multijoueur</h1>
      <CanvasEngine username={effectiveUser} />
      <Hud username={effectiveUser} onOpenAuth={() => setShowModal(true)} onLogout={handleLogout} />
      <PixelInspector />
      <Toaster />
      <AuthDialog
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={(data) => {
          login(data)
          setShowModal(false)
          notify({ kind: 'success', message: `Bienvenue, ${data.username} ! Choisis une couleur pour commencer.` })
        }}
      />
    </main>
  )
}

/**
 * Lien direct vers un pixel (« /?x=-12&y=40 ») : la vue s'y centre et
 * l'inspecteur s'ouvre dessus. C'est le chemin qu'emprunte la modération
 * depuis un signalement.
 */
function useLinkedPixel() {
  useEffect(() => {
    const target = parsePixelLink(window.location.search)
    if (!target) return
    navigateToPixel(target.x, target.y)
    useCanvasStore.getState().setInspectedPixel(target)
  }, [])
}
