'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { apiDeleteAccount } from '../api'
import { useAuthStore } from '../store'
import { notify } from '@features/notifications/store'
import { BORDER_COLOR, ACCENT_RED, MUTED_TEXT, TEXT_COLOR } from '@features/hud/theme'

interface Props {
  /** Appelé une fois le compte supprimé, pour fermer la fenêtre qui l'accueille. */
  onDeleted: () => void
}

/**
 * Droit à l'effacement (RGPD, art. 17).
 *
 * La route existait côté serveur, mais aucune interface ne l'exposait : la
 * politique de confidentialité demandait à l'utilisateur d'envoyer lui-même
 * une requête DELETE authentifiée. Exercer ce droit ne doit pas exiger de
 * compétence technique (art. 12).
 */
export function DeleteAccountSection({ onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const [pending,    setPending]    = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const ids = { password: useId(), details: useId() }

  // Le champ reçoit le focus à l'ouverture : on arrive dans l'étape de confirmation au clavier
  useEffect(() => { if (confirming) passwordRef.current?.focus() }, [confirming])

  function cancel() {
    setConfirming(false)
    setPassword('')
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const token = useAuthStore.getState().token
    if (!token || !password || pending) return

    setPending(true)
    setError(null)
    try {
      await apiDeleteAccount(token, password)
      useAuthStore.getState().logout()
      notify({ kind: 'success', message: 'Ton compte a été supprimé.' })
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur serveur')
      setPending(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{
          padding:      '8px 0',
          background:   'transparent',
          border:       'none',
          color:        MUTED_TEXT,
          fontSize:     12,
          cursor:       'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT_RED)}
        onMouseLeave={(e) => (e.currentTarget.style.color = MUTED_TEXT)}
      >
        Supprimer mon compte…
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel() } }}
      aria-describedby={ids.details}
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
        border:        `1px solid ${ACCENT_RED}`,
        borderRadius:  8,
        padding:       14,
        background:    `${ACCENT_RED}0d`,
      }}
    >
      <span style={{ color: ACCENT_RED, fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
        Supprimer définitivement mon compte
      </span>

      <div id={ids.details} style={{ color: TEXT_COLOR, fontSize: 12, lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>Seront effacés : ton compte, ta progression, tes déblocages et tes statistiques.</p>
        <p style={{ margin: '6px 0 0' }}>
          Tes pixels restent sur le canvas, mais ne portent plus ton pseudo.
          Cette action est irréversible.
        </p>
      </div>

      <label htmlFor={ids.password} style={{ color: MUTED_TEXT, fontSize: 12 }}>
        Confirme avec ton mot de passe
      </label>
      <input
        ref={passwordRef}
        id={ids.password}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={error ? true : undefined}
        style={{
          background:   '#1a1b26',
          border:       `1px solid ${error ? ACCENT_RED : BORDER_COLOR}`,
          borderRadius: 6,
          padding:      '8px 10px',
          color:        TEXT_COLOR,
          fontSize:     13,
        }}
      />

      {error && (
        <p role="alert" style={{ margin: 0, color: ACCENT_RED, fontSize: 12 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={cancel}
          style={{
            flex: 1, padding: '8px 0', background: 'transparent',
            border: `1px solid ${BORDER_COLOR}`, borderRadius: 6,
            color: TEXT_COLOR, fontSize: 12, cursor: 'pointer',
          }}
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!password || pending}
          style={{
            flex: 1, padding: '8px 0',
            background:   !password || pending ? 'transparent' : ACCENT_RED,
            border:       `1px solid ${ACCENT_RED}`,
            borderRadius: 6,
            color:        !password || pending ? ACCENT_RED : '#1a1b26',
            fontSize:     12, fontWeight: 700,
            cursor:       !password || pending ? 'not-allowed' : 'pointer',
            opacity:      !password || pending ? 0.6 : 1,
          }}
        >
          {pending ? 'Suppression…' : 'Supprimer'}
        </button>
      </div>
    </form>
  )
}
