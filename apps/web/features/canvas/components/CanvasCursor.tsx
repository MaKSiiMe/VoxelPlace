'use client'

import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../store'

export function CanvasCursor() {
  const selectedColor   = useCanvasStore((s) => s.selectedColor)
  const colors          = useCanvasStore((s) => s.colors)
  const pixelSize       = useCanvasStore((s) => s.pixelSize)
  const cursorScreenPos = useCanvasStore((s) => s.cursorScreenPos)

  const displayPos  = useRef({ x: 0, y: 0 })
  const rawMousePos = useRef({ x: 0, y: 0 })
  const rafRef      = useRef<number>(0)
  const [, forceRender] = useState(0)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      rawMousePos.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  useEffect(() => {
    const loop = () => {
      const snapped = useCanvasStore.getState().cursorScreenPos
      const target  = snapped ?? rawMousePos.current
      const dx = target.x - displayPos.current.x
      const dy = target.y - displayPos.current.y
      displayPos.current.x += dx * 0.1
      displayPos.current.y += dy * 0.1
      forceRender((n) => n + 1)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  if (selectedColor === null) return null

  const color = colors[selectedColor]
  const size  = cursorScreenPos ? pixelSize : 12
  const { x, y } = displayPos.current

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        top:       0,
        left:      0,
        width:     size,
        height:    size,
        transform: `translate(${x}px, ${y}px)`,
        background: color,
        boxShadow:  `0 0 6px 1px ${color}`,
        zIndex:     15,
        imageRendering: 'pixelated',
        transition: 'width 80ms ease, height 80ms ease',
      }}
    />
  )
}
