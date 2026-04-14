'use client'

import { useState, useEffect } from 'react'
import { GameFrame }    from '@features/hud/components/GameFrame'
import { BottomDrawer } from '@features/hud/components/BottomDrawer'
import { Notch }        from '@features/hud/components/Notch'
import { CanvasEngine } from '@features/canvas/components/CanvasEngine'
import { useSocket }    from '@features/realtime/hooks/useSocket'
import { useCanvasStore, type UserRole } from '@features/canvas/store'
import { AuthModal }    from '@features/auth/components/AuthModal'
import { Minimap }      from '@features/canvas/components/Minimap'
import type { AuthResponse } from '@features/auth/api'

// ── Helpers localStorage ──────────────────────────────────────────────────────

function saveAuth(data: AuthResponse) {
  if (data.token)    localStorage.setItem('voxelplace:token',    data.token)
  if (data.username) localStorage.setItem('voxelplace:username', data.username)
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try { return JSON.parse(atob(token.split('.')[1])) } catch { return null }
}

const VALID_ROLES = new Set<string>(['user', 'superuser', 'admin', 'superadmin'])

function getStoredAuth(): { username: string; role: UserRole | null } {
  const token    = localStorage.getItem('voxelplace:token')
  const username = localStorage.getItem('voxelplace:username') ?? ''
  if (!token) return { username, role: null }
  const payload = decodeJwtPayload(token)
  const role    = payload?.role as string | undefined
  return {
    username,
    role: (role && VALID_ROLES.has(role)) ? role as UserRole : null,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GamePage() {
  const [username,   setUsername]   = useState('')
  const [showModal,  setShowModal]  = useState(false)
  const setRole = useCanvasStore((s) => s.setRole)

  useEffect(() => {
    const { username: stored, role } = getStoredAuth()
    // Username temporaire pour le socket (lecture seule ou connecté)
    setUsername(stored || `viewer_${Math.random().toString(36).slice(2, 6)}`)
    if (role) {
      setRole(role)
    }
    // Pas de token → canvas en spec mode, modal non affichée au chargement
  }, [setRole])

  function handleAuthSuccess(data: AuthResponse) {
    if (data.token && data.username) {
      saveAuth(data)
      setUsername(data.username)
      if (data.role && VALID_ROLES.has(data.role)) setRole(data.role as UserRole)
    }
    // Sinon : "continuer sans compte" → username temporaire déjà set, role reste null
    setShowModal(false)
  }

  function handleLogout() {
    localStorage.removeItem('voxelplace:token')
    setRole(null)
    setShowModal(true)
  }

  useSocket(username)

  if (!username) return null

  return (
    <main className="w-screen h-screen overflow-hidden">
      <h1 className="sr-only">VoxelPlace — Canvas collaboratif multijoueur</h1>
      <CanvasEngine username={username} />
      <Notch />
      <BottomDrawer onLogout={handleLogout} onOpenAuth={() => setShowModal(true)} />
      <GameFrame username={username} onLogout={handleLogout} />
      <Minimap />
      {showModal && <AuthModal onSuccess={handleAuthSuccess} />}
    </main>
  )
}
