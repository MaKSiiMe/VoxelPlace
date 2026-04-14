'use client'

import { BEZEL_COLOR, BORDER_COLOR, ACCENT_BLUE, ACCENT_RED } from '../theme'
import { useCanvasStore } from '@features/canvas/store'

interface Props {
  username: string
  onClose:  () => void
  onLogout: () => void
}

const ROLE_COLORS: Record<string, string> = {
  superuser:  '#e0af68',
  admin:      ACCENT_BLUE,
  superadmin: ACCENT_RED,
}

export function SettingsModal({ username, onClose, onLogout }: Props) {
  const role = useCanvasStore((s) => s.role)
  const badgeColor = role ? (ROLE_COLORS[role] ?? BORDER_COLOR) : BORDER_COLOR

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         50,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:    BEZEL_COLOR,
          border:        `1px solid ${BORDER_COLOR}`,
          borderRadius:  12,
          padding:       28,
          width:         320,
          display:       'flex',
          flexDirection: 'column',
          gap:           20,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: ACCENT_BLUE, fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>
            Paramètres
          </span>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: BORDER_COLOR, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = ACCENT_RED)}
            onMouseLeave={e => (e.currentTarget.style.color = BORDER_COLOR)}
          >
            ✕
          </button>
        </div>

        {/* Profil */}
        {role ? (
          <div style={{
            background:   '#1a1b26',
            border:       `1px solid ${BORDER_COLOR}`,
            borderRadius: 8,
            padding:      '12px 16px',
            display:      'flex',
            alignItems:   'center',
            gap:          12,
          }}>
            <div style={{
              width:        36,
              height:       36,
              borderRadius: '50%',
              background:   `${ACCENT_BLUE}22`,
              border:       `1px solid ${ACCENT_BLUE}`,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              color:        ACCENT_BLUE,
              fontWeight:   700,
              fontSize:     15,
              fontFamily:   'monospace',
              flexShrink:   0,
            }}>
              {username.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ color: '#c0caf5', fontSize: 14, fontWeight: 600 }}>{username}</span>
              <span style={{
                fontSize:     10,
                fontWeight:   700,
                color:        badgeColor,
                border:       `1px solid ${badgeColor}`,
                borderRadius: 4,
                padding:      '1px 5px',
                fontFamily:   'monospace',
                alignSelf:    'flex-start',
              }}>
                {role.toUpperCase()}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ color: BORDER_COLOR, fontSize: 13, textAlign: 'center' }}>
            Non connecté — mode lecture seule
          </div>
        )}

        {/* Séparateur */}
        <div style={{ height: 1, background: BORDER_COLOR }} />

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {role && (
            <button
              onClick={() => { onLogout(); onClose() }}
              style={{
                padding:      '10px 0',
                background:   'transparent',
                border:       `1px solid ${ACCENT_RED}`,
                borderRadius: 6,
                color:        ACCENT_RED,
                fontSize:     13,
                fontWeight:   600,
                cursor:       'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${ACCENT_RED}22` }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              Se déconnecter
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
