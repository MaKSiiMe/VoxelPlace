'use client'

import { useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const BEZEL_COLOR  = '#24283b'
const BORDER_COLOR = '#414868'
const ACCENT_BLUE  = '#7aa2f7'
const ACCENT_GREEN = '#9ece6a'
const ACCENT_RED   = '#f7768e'
const ACCENT_YELLOW = '#e0af68'

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('voxelplace:token') ?? '' : ''
}

export function AdminDashboard() {
  const [promoteResult,  setPromoteResult]  = useState<string | null>(null)
  const [promoteLoading, setPromoteLoading] = useState(false)
  const [restoreResult,  setRestoreResult]  = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)

  async function handleRestoreCanvas() {
    if (!confirm('Restaurer le canvas depuis PostgreSQL ? Les pixels Redis seront remplacés.')) return
    setRestoreLoading(true)
    setRestoreResult(null)
    try {
      const res = await fetch(`${API}/api/admin/restore-canvas`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setRestoreResult(`✅ ${data.restored} pixels restaurés depuis PostgreSQL`)
    } catch (err: unknown) {
      setRestoreResult(`❌ ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    } finally {
      setRestoreLoading(false)
    }
  }

  async function handlePromoteHbtn() {
    setPromoteLoading(true)
    setPromoteResult(null)
    try {
      const res = await fetch(`${API}/api/admin/promote-hbtn`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setPromoteResult(`${data.promoted} compte(s) promu(s) superuser`)
    } catch (err: unknown) {
      setPromoteResult(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setPromoteLoading(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    background:   BEZEL_COLOR,
    border:       `1px solid ${BORDER_COLOR}`,
    borderRadius: 12,
    padding:      24,
    display:      'flex',
    flexDirection: 'column',
    gap:          16,
  }

  const btnStyle = (color: string, disabled?: boolean): React.CSSProperties => ({
    padding:      '10px 20px',
    background:   disabled ? BORDER_COLOR : `${color}22`,
    border:       `1px solid ${disabled ? BORDER_COLOR : color}`,
    borderRadius: 6,
    color:        disabled ? '#1a1b26' : color,
    fontSize:     13,
    fontWeight:   600,
    cursor:       disabled ? 'not-allowed' : 'pointer',
    alignSelf:    'flex-start',
  })

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ color: ACCENT_BLUE, fontWeight: 700, fontSize: 20, fontFamily: 'monospace' }}>
            VoxelPlace
          </span>
          <span style={{ color: BORDER_COLOR, fontSize: 20, fontFamily: 'monospace' }}> / Dashboard</span>
        </div>
        <a
          href="/"
          style={{
            color:          BORDER_COLOR,
            fontSize:       13,
            textDecoration: 'none',
            border:         `1px solid ${BORDER_COLOR}`,
            borderRadius:   6,
            padding:        '6px 14px',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ACCENT_BLUE; (e.currentTarget as HTMLElement).style.borderColor = ACCENT_BLUE }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = BORDER_COLOR; (e.currentTarget as HTMLElement).style.borderColor = BORDER_COLOR }}
        >
          ← Retour au canvas
        </a>
      </div>

      {/* Section — Canvas */}
      <div style={cardStyle}>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={{ color:'#c0caf5', fontWeight:700, fontSize:15 }}>Canvas Redis</span>
          <span style={{ color:BORDER_COLOR, fontSize:13 }}>
            Si le canvas est vide ou corrompu, reconstruit l'état depuis <code style={{ color:ACCENT_BLUE }}>pixel_history</code> (PostgreSQL).
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <button
            style={btnStyle(ACCENT_RED, restoreLoading)}
            disabled={restoreLoading}
            onClick={handleRestoreCanvas}
            onMouseEnter={e => { if (!restoreLoading) (e.currentTarget as HTMLElement).style.background = `${ACCENT_RED}44` }}
            onMouseLeave={e => { if (!restoreLoading) (e.currentTarget as HTMLElement).style.background = `${ACCENT_RED}22` }}
          >
            {restoreLoading ? 'Restauration…' : '🔄 Restaurer le canvas depuis PostgreSQL'}
          </button>
          {restoreResult && (
            <span style={{ color: restoreResult.startsWith('✅') ? ACCENT_GREEN : ACCENT_RED, fontSize:13, fontFamily:'monospace' }}>
              {restoreResult}
            </span>
          )}
        </div>
      </div>

      {/* Section — Gestion des rôles */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: '#c0caf5', fontWeight: 700, fontSize: 15 }}>Gestion des rôles</span>
          <span style={{ color: BORDER_COLOR, fontSize: 13 }}>
            Promouvoir tous les comptes <code style={{ color: ACCENT_YELLOW, fontFamily: 'monospace' }}>hbtn_*</code> en superuser.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            style={btnStyle(ACCENT_YELLOW, promoteLoading)}
            disabled={promoteLoading}
            onClick={handlePromoteHbtn}
            onMouseEnter={e => { if (!promoteLoading) (e.currentTarget as HTMLElement).style.background = `${ACCENT_YELLOW}44` }}
            onMouseLeave={e => { if (!promoteLoading) (e.currentTarget as HTMLElement).style.background = `${ACCENT_YELLOW}22` }}
          >
            {promoteLoading ? '...' : 'Promouvoir hbtn_* → superuser'}
          </button>
          {promoteResult && (
            <span style={{
              color:        promoteResult.includes('Erreur') ? ACCENT_RED : ACCENT_GREEN,
              fontSize:     13,
              fontFamily:   'monospace',
            }}>
              {promoteResult}
            </span>
          )}
        </div>
      </div>

      {/* Section — Rôles et cooldowns */}
      <div style={cardStyle}>
        <span style={{ color: '#c0caf5', fontWeight: 700, fontSize: 15 }}>Rôles & cooldowns</span>
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Rôle', 'Cooldown', 'Obtention'].map(h => (
                <th key={h} style={{ textAlign: 'left', color: BORDER_COLOR, fontWeight: 600, padding: '4px 16px 8px 0', fontSize: 11, letterSpacing: '0.08em', fontFamily: 'monospace' }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { role: 'user',       color: BORDER_COLOR,  cd: '60s',  how: 'Compte standard' },
              { role: 'superuser',  color: ACCENT_YELLOW, cd: '1s',   how: 'Pseudo hbtn_* ou promotion manuelle' },
              { role: 'admin',      color: ACCENT_BLUE,   cd: '5s',   how: 'Attribution manuelle' },
              { role: 'superadmin', color: ACCENT_RED,    cd: '0s',   how: 'Mot de passe admin' },
            ].map(({ role, color, cd, how }) => (
              <tr key={role}>
                <td style={{ padding: '5px 16px 5px 0' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color, border: `1px solid ${color}`,
                    borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace',
                  }}>
                    {role.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '5px 16px 5px 0', color: ACCENT_GREEN, fontFamily: 'monospace' }}>{cd}</td>
                <td style={{ padding: '5px 0', color: BORDER_COLOR }}>{how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
