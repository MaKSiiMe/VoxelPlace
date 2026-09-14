'use client'

import { useEffect, useId, useState } from 'react'
import { Button, Dialog, Field, cn } from '@shared/ui'
import { adminApi } from '../api'

interface Props {
  open:      boolean
  onClose:   () => void
  /** Pseudo prérempli (depuis un signalement ou une recherche). */
  username?: string
  onBanned:  (username: string) => void
}

export const BAN_DURATIONS: { label: string; days: number | null }[] = [
  { label: '1 jour',     days: 1 },
  { label: '7 jours',    days: 7 },
  { label: '30 jours',   days: 30 },
  { label: 'Définitif',  days: null },
]

export function BanDialog({ open, onClose, username: initial = '', onBanned }: Props) {
  const [username, setUsername] = useState(initial)
  const [reason,   setReason]   = useState('')
  const [days,     setDays]     = useState<number | null>(7)
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const groupId = useId()

  useEffect(() => {
    if (!open) return
    setUsername(initial); setReason(''); setDays(7); setError(null)
  }, [open, initial])

  async function submit() {
    const name = username.trim()
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      await adminApi.ban(name, reason, days)
      onBanned(name)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bannissement impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={initial ? `Bannir ${initial}` : 'Bannir un joueur'}
      description="Le joueur est déconnecté aussitôt et ne peut plus poser de pixel."
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        {!initial && (
          <Field label="Pseudo" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={32} autoComplete="off" />
        )}
        <Field
          label="Motif"
          description="Montré au joueur au moment du bannissement."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={256}
          placeholder="Ex. : contenu offensant"
        />
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">Durée</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {BAN_DURATIONS.map((d) => (
              <label key={d.label} className="relative">
                <input
                  type="radio"
                  name={groupId}
                  checked={days === d.days}
                  onChange={() => setDays(d.days)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    'flex h-9 cursor-pointer items-center justify-center rounded-control border text-sm transition-colors',
                    'border-line text-fg-muted hover:border-line-strong hover:text-fg',
                    'peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-fg',
                    'peer-focus-visible:outline-2 peer-focus-visible:outline-accent',
                  )}
                >
                  {d.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="danger" disabled={!username.trim() || busy}>{busy ? 'Bannissement…' : 'Bannir'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
