'use client'

import { useCanvasStore } from '@features/canvas/store'
import { cn } from '@shared/lib/utils'

export function ColorDock() {
  const colors        = useCanvasStore((s) => s.colors)
  const selectedColor = useCanvasStore((s) => s.selectedColor)
  const setSelected   = useCanvasStore((s) => s.setSelectedColor)

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 h-12 px-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center gap-1.5 pointer-events-auto">
      {colors.map((hex, id) => (
        <button
          key={id}
          onClick={() => setSelected(id)}
          title={`Couleur ${id}`}
          className={cn(
            'w-7 h-7 rounded-full border-2 transition-all duration-100',
            selectedColor === id
              ? 'border-white scale-125 shadow-lg'
              : 'border-transparent hover:scale-110 hover:border-white/50',
          )}
          style={{ background: hex }}
        />
      ))}
    </div>
  )
}
