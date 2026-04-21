'use client'

import { useEffect, useState } from 'react'
import { BEZEL_COLOR, BORDER_COLOR, ACCENT_RED } from '@features/hud/theme'
import { getRoleFromToken } from '../../auth/utils'

const ADMIN_ROLES = new Set(['admin', 'superadmin'])

function getRole(): string | null {
  try {
    return getRoleFromToken(localStorage.getItem('voxelplace:token'))
  } catch {
    return null
  }
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    setAuthorized(ADMIN_ROLES.has(getRole() ?? ''))
  }, [])

  if (authorized === null) return null

  if (!authorized) {
    return (
      <div style={{
        minHeight:      '100vh',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     '#1a1b26',
      }}>
        <div style={{
          background:   BEZEL_COLOR,
          border:       `1px solid ${ACCENT_RED}`,
          borderRadius: 12,
          padding:      32,
          textAlign:    'center',
        }}>
          <p style={{ color: ACCENT_RED, fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>
            Accès refusé
          </p>
          <p style={{ color: BORDER_COLOR, fontSize: 14, margin: 0 }}>
            Réservé aux administrateurs.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
