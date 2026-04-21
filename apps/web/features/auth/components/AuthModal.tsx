'use client'

import { useState, type FormEvent } from 'react'
import { apiLogin, apiRegister, type AuthResponse } from '../api'
import { BEZEL_COLOR, BORDER_COLOR, ACCENT_BLUE, ACCENT_RED } from '@features/hud/theme'

interface Props {
  onSuccess: (data: AuthResponse) => void
}

export function AuthModal({ onSuccess }: Props) {
  const [tab, setTab]         = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = tab === 'login'
        ? await apiLogin(username.trim(), password)
        : await apiRegister(username.trim(), password)
      onSuccess(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width:           '100%',
    padding:         '8px 12px',
    background:      '#1a1b26',
    border:          `1px solid ${BORDER_COLOR}`,
    borderRadius:    6,
    color:           '#c0caf5',
    fontSize:        14,
    outline:         'none',
    boxSizing:       'border-box',
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    flex:            1,
    padding:         '8px 0',
    background:      active ? ACCENT_BLUE : 'transparent',
    color:           active ? '#1a1b26' : BORDER_COLOR,
    border:          'none',
    borderRadius:    6,
    fontSize:        13,
    fontWeight:      active ? 700 : 400,
    cursor:          'pointer',
  })

  return (
    /* Overlay */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         50,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }}>
      {/* Card */}
      <div style={{
        background:   BEZEL_COLOR,
        border:       `1px solid ${BORDER_COLOR}`,
        borderRadius: 12,
        padding:      28,
        width:        340,
        minHeight:    340,
        display:      'flex',
        flexDirection:'column',
        gap:          16,
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <span id="auth-modal-title" style={{ color: ACCENT_BLUE, fontWeight: 700, fontSize: 22, fontFamily: 'monospace' }}>
            VoxelPlace
          </span>
          <p style={{ color: BORDER_COLOR, fontSize: 12, margin: '4px 0 0' }}>
            Connectez-vous pour poser des pixels
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#1a1b26', borderRadius: 8, padding: 4 }}>
          <button style={btnStyle(tab === 'login')}    onClick={() => { setTab('login');    setError('') }}>Connexion</button>
          <button style={btnStyle(tab === 'register')} onClick={() => { setTab('register'); setError('') }}>Inscription</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="auth-username" style={{ color: BORDER_COLOR, fontSize: 12 }}>Pseudo</label>
            <input
              id="auth-username"
              style={inputStyle}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="votre pseudo"
              autoComplete="username"
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="auth-password" style={{ color: BORDER_COLOR, fontSize: 12 }}>Mot de passe</label>
            <input
              id="auth-password"
              style={inputStyle}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="6 caractères minimum"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {error && (
            <p style={{ color: ACCENT_RED, fontSize: 12, margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding:       '10px 0',
              background:    loading ? BORDER_COLOR : ACCENT_BLUE,
              color:         '#1a1b26',
              border:        'none',
              borderRadius:  6,
              fontSize:      14,
              fontWeight:    700,
              cursor:        loading ? 'not-allowed' : 'pointer',
              marginTop:     4,
            }}
          >
            {loading ? '...' : tab === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>

        {/* Hint hbtn */}
        {tab === 'register' && (
          <p style={{ color: BORDER_COLOR, fontSize: 11, margin: 0, textAlign: 'center' }}>
            Pseudo <code style={{ color: ACCENT_BLUE }}>hbtn_*</code> → accès superuser automatique
          </p>
        )}

        {/* Continuer sans compte */}
        <button
          onClick={() => onSuccess({ token: '', username: '', role: '' })}
          style={{
            background: 'transparent',
            border:     'none',
            color:      BORDER_COLOR,
            fontSize:   12,
            cursor:     'pointer',
            padding:    0,
          }}
        >
          Continuer sans compte (lecture seule)
        </button>

      </div>
    </div>
  )
}
