'use client'

import { useEffect, useState } from 'react'
import { BEZEL_COLOR, BORDER_COLOR, ACCENT_BLUE, ACCENT_GREEN } from '@features/hud/theme'

const STORAGE_KEY = 'voxelplace:cookies-consent'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Consentement cookies"
      style={{
        position:     'fixed',
        bottom:       16,
        left:         '50%',
        transform:    'translateX(-50%)',
        width:        'min(640px, calc(100vw - 32px))',
        background:   BEZEL_COLOR,
        border:       `1px solid ${BORDER_COLOR}`,
        borderRadius: 12,
        padding:      '16px 20px',
        display:      'flex',
        alignItems:   'center',
        gap:          16,
        zIndex:       9999,
        boxShadow:    '0 4px 24px rgba(0,0,0,0.6)',
        flexWrap:     'wrap',
      }}
    >
      <p style={{ color: '#c0caf5', fontSize: 13, margin: 0, flex: 1, minWidth: 200 }}>
        Ce site utilise le stockage local (localStorage) uniquement pour mémoriser
        votre session et vos préférences. Aucun cookie tiers ni traceur publicitaire.{' '}
        <a
          href="/privacy"
          style={{ color: ACCENT_BLUE, textDecoration: 'underline' }}
        >
          Politique de confidentialité
        </a>
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            background:   'transparent',
            border:       `1px solid ${BORDER_COLOR}`,
            borderRadius: 6,
            padding:      '6px 14px',
            color:        '#a9b1d6',
            fontSize:     13,
            cursor:       'pointer',
          }}
        >
          Refuser
        </button>
        <button
          onClick={accept}
          style={{
            background:   ACCENT_GREEN,
            border:       'none',
            borderRadius: 6,
            padding:      '6px 14px',
            color:        '#1a1b26',
            fontWeight:   700,
            fontSize:     13,
            cursor:       'pointer',
          }}
        >
          Accepter
        </button>
      </div>
    </div>
  )
}
