'use client'

import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '@features/canvas/store'
import { THIN } from '../theme'

const BLUE = '#7aa2f7'

export const NOTCH_W = 128
export const NOTCH_H = 16
export const NOTCH_R = 8

export function notchPath(offsetX: number, offsetY: number): string {
  const W = NOTCH_W, H = NOTCH_H, R = NOTCH_R
  return `
    M ${offsetX},${offsetY}
    Q ${offsetX + R},${offsetY} ${offsetX + R},${offsetY + H - R}
    Q ${offsetX + R},${offsetY + H} ${offsetX + R * 2},${offsetY + H}
    H ${offsetX + W - R * 2}
    Q ${offsetX + W - R},${offsetY + H} ${offsetX + W - R},${offsetY + H - R}
    Q ${offsetX + W - R},${offsetY} ${offsetX + W},${offsetY}
    Z
  `.trim()
}

export function Notch() {
  const hoveredPixel = useCanvasStore((s) => s.hoveredPixel)
  const [remaining, setRemaining] = useState<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const loop = () => {
      const { cooldownEnd } = useCanvasStore.getState()
      if (cooldownEnd) {
        const ms = cooldownEnd - Date.now()
        setRemaining(ms > 0 ? ms : null)
      } else {
        setRemaining(null)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const x = hoveredPixel?.x ?? 0
  const y = hoveredPixel?.y ?? 0
  const label = remaining !== null
    ? `${(remaining / 1000).toFixed(1)}s`
    : `X: ${x}  Y: ${y}`

  return (
    <div
      className="fixed flex justify-center pointer-events-none"
      style={{ top: 0, left: 0, right: 0, zIndex: 25, height: THIN + NOTCH_H }}
    >
      <div
        className="pointer-events-auto flex items-center justify-center"
        style={{
          position:      'absolute',
          top:           0,
          width:         NOTCH_W,
          height:        THIN + NOTCH_H,
          fontFamily:    'monospace',
          fontSize:      10,
          color:         BLUE,
          letterSpacing: '0.05em',
          userSelect:    'none',
        }}
      >
        {label}
      </div>
    </div>
  )
}
