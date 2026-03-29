'use client'

import { useCanvasStore } from '@features/canvas/store'

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-8 px-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center gap-1.5 text-xs text-white/70 font-mono">
      {children}
    </div>
  )
}

export function StatusPills() {
  const players      = useCanvasStore((s) => s.players)
  const hoveredPixel = useCanvasStore((s) => s.hoveredPixel)

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
      <Pill>
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        {players?.count ?? 0} joueur{(players?.count ?? 0) !== 1 ? 's' : ''}
      </Pill>

      {hoveredPixel && (
        <Pill>
          {hoveredPixel.x}, {hoveredPixel.y}
        </Pill>
      )}
    </div>
  )
}
