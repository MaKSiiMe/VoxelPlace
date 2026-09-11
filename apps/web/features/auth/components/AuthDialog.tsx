'use client'

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { apiLogin, apiRegister, type AuthResponse } from '../api'
import { Button, Dialog, Field, cn } from '@shared/ui'

type Mode = 'login' | 'register'

interface Props {
  open:      boolean
  onClose:   () => void
  onSuccess: (data: AuthResponse) => void
}

const TABS: { id: Mode; label: string }[] = [
  { id: 'login',    label: 'Connexion' },
  { id: 'register', label: 'Inscription' },
]

/**
 * Connexion et inscription.
 *
 * L'ancienne fenêtre ne se fermait pas — ni bouton, ni Échap — alors que la
 * déconnexion l'ouvrait d'office : se déconnecter bloquait le joueur dessus.
 */
export function AuthDialog({ open, onClose, onSuccess }: Props) {
  const [mode,     setMode]     = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ login: null, register: null })
  const baseId  = useId()

  function switchTo(next: Mode, focus = false) {
    setMode(next)
    setError(null)
    if (focus) tabRefs.current[next]?.focus()
  }

  // Motif d'onglets ARIA : les flèches passent d'un onglet à l'autre
  function onTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    switchTo(mode === 'login' ? 'register' : 'login', true)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const data = mode === 'login'
        ? await apiLogin(username.trim(), password)
        : await apiRegister(username.trim(), password)
      onSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Rejoindre la toile"
      description="Un compte pour poser tes pixels — le même canvas que les joueurs de Minecraft."
    >
      <div role="tablist" aria-label="Type de compte" className="mb-5 grid grid-cols-2 gap-1 rounded-control bg-bg p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[t.id] = el }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${t.id}`}
            aria-selected={mode === t.id}
            aria-controls={`${baseId}-panel`}
            tabIndex={mode === t.id ? 0 : -1}
            onClick={() => switchTo(t.id)}
            onKeyDown={onTabKey}
            className={cn(
              'h-8 rounded-md text-sm font-medium transition-colors duration-150',
              mode === t.id ? 'bg-surface-2 text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${mode}`}
        onSubmit={submit}
        className="flex flex-col gap-4"
      >
        <Field
          label="Pseudo"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          minLength={2}
          maxLength={32}
          description={mode === 'register' ? 'Entre 2 et 32 caractères, visible par les autres joueurs.' : undefined}
        />
        <Field
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          minLength={6}
          description={mode === 'register' ? '6 caractères minimum.' : undefined}
        />

        {error && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <Button type="submit" variant="primary" size="lg" disabled={loading} className="mt-1 w-full">
          {loading ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-fg-subtle">
        En créant un compte, tu acceptes la <a href="/privacy" className="text-accent underline underline-offset-2">politique de confidentialité</a>.
      </p>
    </Dialog>
  )
}
