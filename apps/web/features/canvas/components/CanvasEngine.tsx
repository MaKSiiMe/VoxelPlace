'use client'

import { useRef } from 'react'
import { usePixiCanvas } from '../hooks/usePixiCanvas'
import { CanvasCursor } from './CanvasCursor'

interface Props {
  username: string
}

export function CanvasEngine({ username }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  usePixiCanvas(containerRef, username)

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0"
        style={{
          background:  '#1a1b26',
          touchAction: 'none',
          cursor:      'crosshair',
        }}
      />
      <div
        id="canvas-grid-overlay"
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 11,
          opacity: 0,
          backgroundImage: `
            linear-gradient(to right, #414868 1px, transparent 1px),
            linear-gradient(to bottom, #414868 1px, transparent 1px)
          `,
        }}
      />
      <CanvasCursor />
    </>
  )
}
