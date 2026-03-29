'use client'

import { useRef } from 'react'
import { usePixiCanvas } from '../hooks/usePixiCanvas'

interface Props {
  username: string
}

export function CanvasEngine({ username }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  usePixiCanvas(containerRef, username)

  return (
    <div
      ref={containerRef}
      className="fixed inset-0"
      style={{ background: '#ffffff', touchAction: 'none' }}
    />
  )
}
