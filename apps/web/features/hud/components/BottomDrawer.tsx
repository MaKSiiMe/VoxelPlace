'use client'

import { useState } from 'react'
import { useCanvasStore } from '@features/canvas/store'
import { THIN, TASKBAR, BEZEL_COLOR, BORDER_COLOR } from '../theme'

const GAP = 8

export function BottomDrawer() {
  const [open, setOpen] = useState(false)

  const colors        = useCanvasStore((s) => s.colors)
  const selectedColor = useCanvasStore((s) => s.selectedColor)
  const setSelected   = useCanvasStore((s) => s.setSelectedColor)
  const role          = useCanvasStore((s) => s.role)

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
      <div className="flex flex-col items-center">

        {/* Pill */}
        <div
          className="h-10 px-3 rounded-full flex items-center gap-2"
          style={{
            background:    BEZEL_COLOR,
            border:        `1px solid ${BORDER_COLOR}`,
            transition:    'opacity 200ms ease, transform 200ms ease',
            opacity:       open ? 1 : 0,
            transform:     open ? 'translateY(0)' : 'translateY(6px)',
            pointerEvents: open ? 'auto' : 'none',
          }}
          {...handlers}
        >
          {!role ? (
            <span style={{ color: BORDER_COLOR, fontSize: 12, padding: '0 8px' }}>
              Connectez-vous pour poser des pixels
            </span>
          ) : colors.map((hex, id) => (
            <button
              key={id}
              onClick={() => setSelected(selectedColor === id ? null : id)}
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


        {/* Bridge */}
        <div
          style={{
            width:         '100%',
            height:        GAP,
            pointerEvents: open ? 'auto' : 'none',
          }}
          {...handlers}
        />

        {/* Trigger — seulement le bord bas du cadre */}
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
