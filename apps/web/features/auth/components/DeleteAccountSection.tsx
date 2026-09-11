'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { apiDeleteAccount } from '../api'
import { useAuthStore } from '../store'
import { notify } from '@features/notifications/store'
import { Button } from '@shared/ui'

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
        className="text-sm text-fg-subtle underline underline-offset-4 transition-colors hover:text-danger"
      >
        Supprimer mon compte…
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); cancel() } }}
      aria-describedby={ids.details}
      className="flex flex-col gap-3 rounded-control border border-danger/40 bg-danger/5 p-4"
    >
      <p className="text-sm font-semibold text-danger">Supprimer définitivement mon compte</p>

      <div id={ids.details} className="flex flex-col gap-1.5 text-sm text-fg-muted">
        <p>Seront effacés : ton compte, ta progression, tes déblocages et tes statistiques.</p>
        <p>Tes pixels restent sur le canvas, mais ne portent plus ton pseudo. Cette action est irréversible.</p>
      </div>

      <label htmlFor={ids.password} className="text-sm text-fg">Confirme avec ton mot de passe</label>
      <input
        ref={passwordRef}
        id={ids.password}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`h-10 rounded-control border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-accent ${error ? 'border-danger' : 'border-line'}`}
      />

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={cancel} className="flex-1">Annuler</Button>
        <Button type="submit" variant="danger" disabled={!password || pending} className="flex-1">
          {pending ? 'Suppression…' : 'Supprimer'}
        </Button>
      </div>
    </form>
  )
}
