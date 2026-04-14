'use client'

import { useEffect } from 'react'
import { socket } from '../socket'
import { useCanvasStore } from '@features/canvas/store'

export function useSocket(username: string) {
  const { setGrid, setGridSize, setPlayers, updatePixel } = useCanvasStore()

  useEffect(() => {
    if (!username) return

    socket.connect()
    socket.emit('player:join', { username, source: 'web' })

    // colors ignoré — le client utilise sa propre palette (DEFAULT_COLORS dans store.ts)
    socket.on('grid:init', ({ grid, size, players }) => {
      setGrid(new Uint8Array(grid))
      setGridSize(size)
      if (players) setPlayers(players)
    })

    socket.on('pixel:update', ({ x, y, colorId }: { x: number; y: number; colorId: number }) => {
      updatePixel(x, y, colorId)
    })

    socket.on('players:update', (payload) => {
      setPlayers(payload)
    })

    socket.on('canvas:reload', () => {
      socket.emit('grid:request')
    })

    return () => {
      socket.off('grid:init')
      socket.off('pixel:update')
      socket.off('players:update')
      socket.off('canvas:reload')
      socket.disconnect()
    }
  }, [username]) // eslint-disable-line react-hooks/exhaustive-deps
}
