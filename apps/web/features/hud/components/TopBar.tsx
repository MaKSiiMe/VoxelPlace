'use client'

import { useCanvasStore } from '@features/canvas/store'
import { Surface } from '@shared/ui'

/** Logo : quatre pixels, aux couleurs de la palette. */
function Logo() {
  return (
    <span aria-hidden="true" className="grid size-5 grid-cols-2 gap-[2px]">
      <span className="rounded-[2px] bg-[#FF4444]" />
      <span className="rounded-[2px] bg-[#44AAFF]" />
      <span className="rounded-[2px] bg-[#FFFF00]" />
      <span className="rounded-[2px] bg-[#88CC22]" />
    </span>
  )
}

export function Brand() {
  const players = useCanvasStore((s) => s.players)
  const count   = players?.count ?? 0
  return (
    <Surface className="flex h-11 items-center gap-2.5 pl-3 pr-3 sm:gap-3 sm:pr-4">
      <Logo />
      <span className="sr-only sm:hidden">VoxelPlace</span>
      {/* Sur petit écran, le nom cède sa place à la barre d'outils voisine */}
      <span className="hidden text-sm font-semibold tracking-tight text-fg sm:inline">VoxelPlace</span>
      <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-fg-muted">
        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        <span className="tabular-nums text-fg">{count}</span>
        <span className="sr-only sm:not-sr-only">en ligne</span>
      </span>
    </Surface>
  )
}

/**
 * Coordonnées du pixel survolé, dans le repère du HUD.
 * Composant isolé : seul lui se re-rend au survol, pas le reste de l'interface.
 */
export function CoordinatesPill() {
  const hovered   = useCanvasStore((s) => s.hoveredPixel)
  const pixelSize = useCanvasStore((s) => s.pixelSize)
  return (
    <Surface className="flex h-9 items-center gap-3 px-3 font-mono text-xs text-fg-muted" aria-hidden="true">
      <span className="tabular-nums">
        {hovered ? <>X <span className="text-fg">{hovered.x}</span>  Y <span className="text-fg">{hovered.y}</span></> : 'Survole la toile'}
      </span>
      <span className="h-3 w-px bg-line" />
      <span className="tabular-nums">×{pixelSize >= 1 ? Math.round(pixelSize) : pixelSize.toFixed(2)}</span>
    </Surface>
  )
}
