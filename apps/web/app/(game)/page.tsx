'use client'

import { useEffect, useRef, useState } from 'react'
import { GameFrame }      from '@features/hud/components/GameFrame'
import { BottomDrawer }   from '@features/hud/components/BottomDrawer'
import { Notch }          from '@features/hud/components/Notch'
import { CanvasEngine }   from '@features/canvas/components/CanvasEngine'
import { useSocket }      from '@features/realtime/hooks/useSocket'
import { useCanvasStore } from '@features/canvas/store'
import { useAuthStore }   from '@features/auth/store'
import { AuthModal }      from '@features/auth/components/AuthModal'
import { Minimap }        from '@features/canvas/components/Minimap'

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

  if (!effectiveUser) return null

  function handleLogout() {
    logout()
    setShowModal(true)
  }

  return (
    <main className="w-screen h-screen overflow-hidden">
      <h1 className="sr-only">VoxelPlace — Canvas collaboratif multijoueur</h1>
      <CanvasEngine username={effectiveUser} />
      <Notch />
      <BottomDrawer onLogout={handleLogout} onOpenAuth={() => setShowModal(true)} />
      <GameFrame username={effectiveUser} onLogout={handleLogout} />
      <Minimap />
      {showModal && (
        <AuthModal onSuccess={(data) => { login(data); setShowModal(false) }} />
      )}
    </main>
  )
}
