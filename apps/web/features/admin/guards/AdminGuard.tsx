'use client'

import { useEffect, useState } from 'react'
import { BEZEL_COLOR, BORDER_COLOR, ACCENT_RED, ACCENT_BLUE } from '@features/hud/theme'
import { getRoleFromToken } from '../../auth/utils'
import { API_URL } from '@shared/api'

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
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    setAuthorized(ADMIN_ROLES.has(getRole() ?? ''))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`${API_URL}/api/admin/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Mot de passe incorrect')
      localStorage.setItem('voxelplace:token', data.token)
      setAuthorized(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

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
        <form onSubmit={handleLogin} style={{
          background:   BEZEL_COLOR,
          border:       `1px solid ${BORDER_COLOR}`,
          borderRadius: 12,
          padding:      32,
          display:      'flex',
          flexDirection: 'column',
          gap:          12,
          minWidth:     280,
        }}>
          <p style={{ color: '#c0caf5', fontWeight: 700, fontSize: 18, margin: 0, textAlign: 'center' }}>
            Administration
          </p>

          <input
            type="password"
            placeholder="Mot de passe admin"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{
              background:   '#1a1b26',
              border:       `1px solid ${BORDER_COLOR}`,
              borderRadius: 6,
              padding:      '8px 12px',
              color:        '#c0caf5',
              fontSize:     14,
              outline:      'none',
            }}
          />

          {error && (
            <p style={{ color: ACCENT_RED, fontSize: 13, margin: 0, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading || !password} style={{
            background:    loading ? BORDER_COLOR : ACCENT_BLUE,
            border:        'none',
            borderRadius:  6,
            padding:       '8px 16px',
            color:         '#1a1b26',
            fontWeight:    700,
            fontSize:      14,
            cursor:        loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '...' : 'Connexion'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
