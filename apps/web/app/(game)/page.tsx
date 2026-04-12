'use client'

import { useState, useEffect } from 'react'
import { GameFrame }    from '@features/hud/components/GameFrame'
import { BottomDrawer } from '@features/hud/components/BottomDrawer'
import { Notch }        from '@features/hud/components/Notch'
import { CanvasEngine } from '@features/canvas/components/CanvasEngine'
import { useSocket }    from '@features/realtime/hooks/useSocket'

function getOrCreateUsername(): string {
  let username = localStorage.getItem('voxelplace:username')
  if (!username) {
    username = `player_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem('voxelplace:username', username)
  }
  return username
}

export default function GamePage() {
  const [username, setUsername] = useState('')

  useEffect(() => {
    setUsername(getOrCreateUsername())
  }, [])

  useSocket(username)

  if (!username) return null

  return (
    <main className="w-screen h-screen overflow-hidden">
      <CanvasEngine username={username} />
      <Notch />
      <BottomDrawer />
      <GameFrame />
    </main>
  )
}
