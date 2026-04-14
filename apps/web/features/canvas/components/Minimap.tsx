'use client'

import { useEffect, useRef } from 'react'
import { useCanvasStore, DEFAULT_COLORS } from '../store'
import { navigateToPixel } from '../viewportState'
import { BORDER_COLOR } from '@features/hud/theme'

const MAP_SIZE  = 256
const MAP_DISP  = 180
const GRID_SIZE = 2048

const PALETTE_RGBA = new Uint8ClampedArray(DEFAULT_COLORS.length * 4)
DEFAULT_COLORS.forEach((hex, i) => {
  PALETTE_RGBA[i * 4]     = parseInt(hex.slice(1, 3), 16)
  PALETTE_RGBA[i * 4 + 1] = parseInt(hex.slice(3, 5), 16)
  PALETTE_RGBA[i * 4 + 2] = parseInt(hex.slice(5, 7), 16)
  PALETTE_RGBA[i * 4 + 3] = 255
})

export function Minimap() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const pendingRef = useRef<Uint8Array | null>(null)

  useEffect(() => {
    function renderToCanvas(grid: Uint8Array) {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const imgData = ctx.createImageData(MAP_SIZE, MAP_SIZE)
      const data    = imgData.data

      for (let my = 0; my < MAP_SIZE; my++) {
        const gy = Math.floor((MAP_SIZE - 1 - my) * GRID_SIZE / MAP_SIZE)
        for (let mx = 0; mx < MAP_SIZE; mx++) {
          const gx = Math.floor(mx * GRID_SIZE / MAP_SIZE)
          const ci = (grid[gy * GRID_SIZE + gx] ?? 0) & 0x0F
          const pi = ci * 4
          const di = (my * MAP_SIZE + mx) * 4
          data[di]     = PALETTE_RGBA[pi]
          data[di + 1] = PALETTE_RGBA[pi + 1]
          data[di + 2] = PALETTE_RGBA[pi + 2]
          data[di + 3] = 255
        }
      }
      ctx.putImageData(imgData, 0, 0)
    }

    function scheduleRender(grid: Uint8Array | null) {
      if (!grid) return
      pendingRef.current = grid
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0
          if (pendingRef.current) renderToCanvas(pendingRef.current)
        })
      }
    }

    // Rendu initial
    scheduleRender(useCanvasStore.getState().grid)

    // Abonnement aux mises à jour
    const unsub = useCanvasStore.subscribe((s) => s.grid, scheduleRender)
    return () => {
      unsub()
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx   = (e.clientX - rect.left) / MAP_DISP * MAP_SIZE
    const my   = (e.clientY - rect.top)  / MAP_DISP * MAP_SIZE
    const gx   = Math.floor(mx * GRID_SIZE / MAP_SIZE)
    const gy   = Math.floor((MAP_SIZE - 1 - my) * GRID_SIZE / MAP_SIZE)
    navigateToPixel(gx, gy)
  }

  return (
    <div
      title="Cliquer pour naviguer"
      style={{
        position:     'fixed',
        bottom:       84,
        right:        28,
        zIndex:       21,
        borderRadius: 8,
        overflow:     'hidden',
        border:       `1px solid ${BORDER_COLOR}`,
        boxShadow:    '0 4px 24px rgba(0,0,0,0.6)',
        cursor:       'crosshair',
      }}
    >
      <canvas
        ref={canvasRef}
        width={MAP_SIZE}
        height={MAP_SIZE}
        style={{ display: 'block', width: MAP_DISP, height: MAP_DISP, imageRendering: 'pixelated' }}
        onClick={handleClick}
      />
    </div>
  )
}
