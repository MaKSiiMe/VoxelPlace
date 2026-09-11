'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic            from 'next/dynamic'
import { Hud }            from '@features/hud/components/Hud'
import { useSocket }      from '@features/realtime/hooks/useSocket'
import { useCanvasStore } from '@features/canvas/store'
import { useAuthStore }   from '@features/auth/store'
import { Toaster }        from '@features/notifications/components/Toaster'
import { useSocketNotifications } from '@features/notifications/hooks/useSocketNotifications'

const CanvasEngine = dynamic(
  () => import('@features/canvas/components/CanvasEngine').then(m => ({ default: m.CanvasEngine })),
  { ssr: false }
)
const AuthModal = dynamic(
  () => import('@features/auth/components/AuthModal').then(m => ({ default: m.AuthModal })),
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

  if (!effectiveUser) return null

  function handleLogout() {
    logout()
    setShowModal(true)
  }

  return (
    <main className="w-screen h-screen overflow-hidden">
      <h1 className="sr-only">VoxelPlace — Canvas collaboratif multijoueur</h1>
      <CanvasEngine username={effectiveUser} />
      <Hud username={effectiveUser} onOpenAuth={() => setShowModal(true)} onLogout={handleLogout} />
      <PixelInspector />
      <Toaster />
      {showModal && (
        <AuthModal onSuccess={(data) => { login(data); setShowModal(false) }} />
      )}
    </main>
  )
}
