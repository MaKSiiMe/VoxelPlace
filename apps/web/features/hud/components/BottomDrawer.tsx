'use client'

import { useCanvasStore } from '@features/canvas/store'
import { THIN, TASKBAR, BEZEL_COLOR, BORDER_COLOR, ACCENT_BLUE, ACCENT_RED } from '../theme'

interface Props {
  onLogout?:    () => void
  onOpenAuth?:  () => void
}

export function BottomDrawer({ onLogout, onOpenAuth }: Props) {
  const colors        = useCanvasStore((s) => s.colors)
  const selectedColor = useCanvasStore((s) => s.selectedColor)
  const setSelected   = useCanvasStore((s) => s.setSelectedColor)
  const role          = useCanvasStore((s) => s.role)

  // Badge couleur selon le rôle
  const roleBadgeColor: Record<string, string> = {
    superuser:   '#e0af68',
    admin:       ACCENT_BLUE,
    superadmin:  ACCENT_RED,
  }
  const badgeColor = role ? (roleBadgeColor[role] ?? BORDER_COLOR) : BORDER_COLOR

  return (
    <div
      className="fixed"
      style={{
        bottom:         16,
        left:           TASKBAR,
        right:          THIN,
        zIndex:         22,
        display:        'flex',
        justifyContent: 'center',
        alignItems:     'flex-end',
        pointerEvents:  'none',
      }}
    >
      {/* Pill */}
      <div
        className="h-10 px-3 rounded-full flex items-center gap-2"
        style={{
          background:    BEZEL_COLOR,
          border:        `1px solid ${BORDER_COLOR}`,
          pointerEvents: 'auto',
        }}
      >
        {!role ? (
          <button
            onClick={onOpenAuth}
            style={{
              background: 'transparent',
              border:     'none',
              color:      BORDER_COLOR,
              fontSize:   12,
              padding:    '0 8px',
              cursor:     'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = ACCENT_BLUE)}
            onMouseLeave={e => (e.currentTarget.style.color = BORDER_COLOR)}
          >
            Connectez-vous pour poser des pixels
          </button>
        ) : (
          <>
            {/* Badge rôle */}
            {role !== 'user' && (
              <span style={{
                fontSize:     10,
                fontWeight:   700,
                color:        badgeColor,
                border:       `1px solid ${badgeColor}`,
                borderRadius: 4,
                padding:      '1px 5px',
                fontFamily:   'monospace',
                flexShrink:   0,
              }}>
                {role.toUpperCase()}
              </span>
            )}

            {/* Séparateur */}
            {role !== 'user' && (
              <div style={{ width: 1, height: 16, background: BORDER_COLOR, flexShrink: 0 }} />
            )}

            {/* Palette */}
            {colors.map((hex, id) => (
              <button
                key={id}
                onClick={() => setSelected(selectedColor === id ? null : id)}
                title={`Couleur ${id}`}
                aria-label={`Couleur ${id}${selectedColor === id ? ' (sélectionnée)' : ''}`}
                aria-pressed={selectedColor === id}
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

            {/* Séparateur + déconnexion */}
            <div style={{ width: 1, height: 16, background: BORDER_COLOR, flexShrink: 0 }} />
            <button
              onClick={onLogout}
              title="Se déconnecter"
              style={{
                background: 'transparent',
                border:     'none',
                color:      BORDER_COLOR,
                cursor:     'pointer',
                padding:    '2px 4px',
                fontSize:   16,
                lineHeight: 1,
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = ACCENT_RED)}
              onMouseLeave={e => (e.currentTarget.style.color = BORDER_COLOR)}
            >
              ⏻
            </button>
          </>
        )}
      </div>
    </div>
  )
}
