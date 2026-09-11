'use client'

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'

/** Part de la distance restante parcourue à chaque frame : aimanté sans traîner. */
const FOLLOW = 0.3
const OFF_GRID_SIZE = 12

/**
 * Aperçu de la couleur sélectionnée sous la souris, aimanté sur la grille.
 *
 * L'ancienne version relançait un rendu React à chaque frame, pour tous les
 * visiteurs et en permanence — même sans couleur sélectionnée, quand elle ne
 * rendait rien. La position est désormais écrite directement dans le DOM, et
 * la boucle ne tourne qu'en mode Build.
 */
export function CanvasCursor() {
  const selectedColor = useCanvasStore((s) => s.selectedColor)
  const colors        = useCanvasStore((s) => s.colors)
  const ref           = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedColor === null) return
    const el = ref.current
    if (!el) return

    let raw: { x: number; y: number } | null = null
    const display = { x: 0, y: 0 }
    let raf = 0

    const onMove = (e: PointerEvent) => {
      // Sur écran tactile il n'y a pas de survol : rien à prévisualiser
      if (e.pointerType !== 'mouse') return
      if (!raw) { display.x = e.clientX; display.y = e.clientY }
      raw = { x: e.clientX, y: e.clientY }
    }

    const loop = () => {
      const { cursorScreenPos, pixelSize } = useCanvasStore.getState()
      const target = cursorScreenPos ?? raw
      if (target) {
        display.x += (target.x - display.x) * FOLLOW
        display.y += (target.y - display.y) * FOLLOW
        const size = cursorScreenPos ? pixelSize : OFF_GRID_SIZE
        el.style.opacity   = '1'
        el.style.width     = `${size}px`
        el.style.height    = `${size}px`
        el.style.transform = `translate3d(${display.x}px, ${display.y}px, 0)`
      }
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [selectedColor])

  if (selectedColor === null) return null
  const color = colors[selectedColor]

  return (
    <div
      ref={ref}
      aria-hidden="true"
      // Invisible tant que la souris n'a pas bougé : il s'affichait sinon collé au coin haut-gauche
      className="pointer-events-none fixed left-0 top-0 z-[15] opacity-0 [image-rendering:pixelated] [@media(pointer:coarse)]:hidden"
      style={{ background: color, boxShadow: `0 0 6px 1px ${color}` }}
    />
  )
}
