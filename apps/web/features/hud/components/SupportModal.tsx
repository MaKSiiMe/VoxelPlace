'use client'

import { BEZEL_COLOR, BORDER_COLOR, ACCENT_BLUE, ACCENT_GREEN, ACCENT_RED } from '../theme'

interface Props {
  onClose: () => void
}

const ROLE_ROWS = [
  { role: 'user',       color: BORDER_COLOR,  cooldown: '60s',  desc: 'Compte standard' },
  { role: 'superuser',  color: '#e0af68',     cooldown: '1s',   desc: 'Beta testeur (hbtn_*)' },
  { role: 'admin',      color: ACCENT_BLUE,   cooldown: '5s',   desc: 'Modérateur' },
  { role: 'superadmin', color: ACCENT_RED,    cooldown: '0s',   desc: 'Accès total' },
]

export function SupportModal({ onClose }: Props) {
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
          width:         380,
          display:       'flex',
          flexDirection: 'column',
          gap:           20,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: ACCENT_BLUE, fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>
            Comment jouer
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

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { n: '1', text: 'Connectez-vous ou créez un compte pour poser des pixels.' },
            { n: '2', text: 'Sélectionnez une couleur dans la palette en bas.' },
            { n: '3', text: 'Cliquez sur le canvas pour poser un pixel.' },
            { n: '4', text: 'Attendez le cooldown avant de poser le suivant.' },
          ].map(({ n, text }) => (
            <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                background:   `${ACCENT_BLUE}22`,
                border:       `1px solid ${ACCENT_BLUE}`,
                color:        ACCENT_BLUE,
                borderRadius: 4,
                fontSize:     11,
                fontWeight:   700,
                fontFamily:   'monospace',
                padding:      '1px 6px',
                flexShrink:   0,
              }}>{n}</span>
              <span style={{ color: '#c0caf5', fontSize: 13 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Séparateur */}
        <div style={{ height: 1, background: BORDER_COLOR }} />

        {/* Rôles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: BORDER_COLOR, fontSize: 11, fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
            COOLDOWNS PAR RÔLE
          </span>
          {ROLE_ROWS.map(({ role, color, cooldown, desc }) => (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize:     10,
                fontWeight:   700,
                color,
                border:       `1px solid ${color}`,
                borderRadius: 4,
                padding:      '1px 5px',
                fontFamily:   'monospace',
                flexShrink:   0,
                minWidth:     76,
                textAlign:    'center',
              }}>
                {role.toUpperCase()}
              </span>
              <span style={{ color: ACCENT_GREEN, fontFamily: 'monospace', fontSize: 12, flexShrink: 0 }}>{cooldown}</span>
              <span style={{ color: BORDER_COLOR, fontSize: 12 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
