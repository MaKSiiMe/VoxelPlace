'use client'

import { useEffect } from 'react'
import { socket } from '../socket'
import { useCanvasStore } from '@features/canvas/store'

/**
 * Normalise la grille reçue en Uint8Array.
 *
 * Le serveur l'envoie en binaire, que Socket.io livre en ArrayBuffer. Le
 * tableau de nombres reste accepté : c'est le format qu'utilisait l'ancien
 * protocole, et un client peut se retrouver face à un serveur non encore
 * redéployé.
 */
function toGrid(grid: ArrayBuffer | Uint8Array | number[]): Uint8Array {
  if (grid instanceof Uint8Array)  return grid
  if (grid instanceof ArrayBuffer) return new Uint8Array(grid)
  return Uint8Array.from(grid)
}

export function useSocket(username: string) {
  const { setGrid, setGridSize, setPlayers, updatePixel } = useCanvasStore()

  useEffect(() => {
    if (!username) return

    let gridLoaded = false

    socket.connect()
    socket.emit('player:join', { username, source: 'web' })

    // colors ignoré — le client utilise sa propre palette (DEFAULT_COLORS dans store.ts)
    // N'applique grid:init qu'une seule fois — les reconnexions ne doivent pas écraser le canvas
    socket.on('grid:init', ({ grid, size, players }) => {
      if (gridLoaded) return
      gridLoaded = true
      setGrid(toGrid(grid))
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
      gridLoaded = false
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
