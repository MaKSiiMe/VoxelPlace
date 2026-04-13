'use client'

import { useState, useEffect } from 'react'
import { GameFrame }    from '@features/hud/components/GameFrame'
import { BottomDrawer } from '@features/hud/components/BottomDrawer'
import { Notch }        from '@features/hud/components/Notch'
import { CanvasEngine } from '@features/canvas/components/CanvasEngine'
import { useSocket }    from '@features/realtime/hooks/useSocket'
import { useCanvasStore, type UserRole } from '@features/canvas/store'

function getOrCreateUsername(): string {
  let username = localStorage.getItem('voxelplace:username')
  if (!username) {
    username = `player_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem('voxelplace:username', username)
  }
  return username
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

const VALID_ROLES = new Set(['user', 'superuser', 'admin', 'superadmin'])

export default function GamePage() {
  const [username, setUsername] = useState('')
  const setRole = useCanvasStore((s) => s.setRole)

  useEffect(() => {
    setUsername(getOrCreateUsername())

    const token = localStorage.getItem('voxelplace:token')
    if (token) {
      const payload = decodeJwtPayload(token)
      const role = payload?.role as string | undefined
      if (role && VALID_ROLES.has(role)) setRole(role as UserRole)
    }
  }, [setRole])

  useSocket(username)

  if (!username) return null

  return (
    <main className="w-screen h-screen overflow-hidden">
      <h1 className="sr-only">VoxelPlace — Canvas collaboratif multijoueur</h1>
      <CanvasEngine username={username} />
      <Notch />
      <BottomDrawer />
      <GameFrame />
    </main>
  )
}
