'use client'

import { useState } from 'react'
import { useCanvasStore } from '@features/canvas/store'
import { cn } from '@shared/lib/utils'

const THIN    = 12
const TASKBAR = 64
const GAP     = 8   // espace entre pill et cadre

export function BottomDrawer() {
  const [open, setOpen] = useState(false)

  const colors        = useCanvasStore((s) => s.colors)
  const selectedColor = useCanvasStore((s) => s.selectedColor)
  const setSelected   = useCanvasStore((s) => s.setSelectedColor)

  const handlers = {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
  }

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        bottom:         0,
        left:           TASKBAR,
        right:          THIN,
        zIndex:         22,
        display:        'flex',
        justifyContent: 'center',
        alignItems:     'flex-end',
      }}
    >
      {/*
        Colonne centrée — pill + bridge + trigger.
        La largeur naturelle de la pill dicte celle du trigger et du bridge.
      */}
      <div className="flex flex-col items-center">

        {/* Pill */}
        <div
          className="h-10 px-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center gap-2"
          style={{
            transition:    'opacity 200ms ease, transform 200ms ease',
            opacity:       open ? 1 : 0,
            transform:     open ? 'translateY(0)' : 'translateY(6px)',
            pointerEvents: open ? 'auto' : 'none',
          }}
          {...handlers}
        >
          {colors.map((hex, id) => (
            <button
              key={id}
              onClick={() => setSelected(id)}
              title={`Couleur ${id}`}
              style={{
                background:   hex,
                width:        22,
                height:       22,
                borderRadius: 5,
                border:       'none',
                outline:      'none',
                cursor:       'pointer',
                flexShrink:   0,
                transform:    selectedColor === id ? 'scale(1.2)' : 'scale(1)',
                boxShadow:    selectedColor === id
                  ? `0 0 8px 2px ${hex}, 0 0 16px 4px ${hex}80`
                  : 'none',
                transition:   'transform 120ms ease, box-shadow 120ms ease',
              }}
            />
          ))}
        </div>

        {/* Bridge — comble le gap pill↔cadre, actif seulement quand ouvert */}
        <div
          style={{
            width:         '100%',
            height:        GAP,
            pointerEvents: open ? 'auto' : 'none',
          }}
          {...handlers}
        />

        {/* Trigger — largeur de la pill, hauteur du bord bas du cadre uniquement */}
        <div
          style={{
            width:         '100%',
            height:        THIN,
            pointerEvents: 'auto',
          }}
          {...handlers}
        />

      </div>
    </div>
  )
}
