'use client'

import { useEffect, useState } from 'react'
import { useCanvasStore } from '@features/canvas/store'

export interface CooldownState {
  active:      boolean
  remainingMs: number
  /** 0 au début du cooldown, 1 une fois écoulé. */
  progress:    number
}

export function cooldownState(now: number, end: number | null, duration: number): CooldownState {
  if (!end || duration <= 0 || end <= now) return { active: false, remainingMs: 0, progress: 1 }
  const remainingMs = end - now
  return { active: true, remainingMs, progress: Math.min(1, Math.max(0, 1 - remainingMs / duration)) }
}

/** Secondes restantes, arrondies à l'unité supérieure : on n'affiche jamais « 0 s » avant la fin. */
export function formatRemaining(ms: number): string {
  return `${Math.ceil(ms / 1000)} s`
}

/**
 * Cooldown courant, rafraîchi dix fois par seconde — et seulement pendant un
 * cooldown. L'ancienne notch et la bordure du bezel relançaient un rendu React
 * à chaque frame, en permanence.
 */
export function useCooldown(): CooldownState {
  const end      = useCanvasStore((s) => s.cooldownEnd)
  const duration = useCanvasStore((s) => s.cooldownDuration)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    if (!end || end <= Date.now()) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= end) clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [end])

  return cooldownState(now, end, duration)
}
