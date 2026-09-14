'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button, Field } from '@shared/ui'
import { adminApi } from '../api'
import { clearAdminToken, getAdminSession, storeAdminToken, type AdminSession } from '../session'

interface Props {
  children: (session: AdminSession, logout: () => void) => ReactNode
}

/**
 * Accès au tableau de bord : un compte joueur modérateur passe directement,
 * sinon le mot de passe d'administration est demandé.
 */
export function AdminGuard({ children }: Props) {
  const [session,  setSession]  = useState<AdminSession | null | undefined>(undefined)
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => { setSession(getAdminSession()) }, [])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    if (loading || !password) return
    setLoading(true)
    setError(null)
    try {
      const { token } = await adminApi.login(password)
      storeAdminToken(token)
      setSession(getAdminSession())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    clearAdminToken()
    setPassword('')
    setSession(getAdminSession())
  }

  if (session === undefined) return null
  if (session) return <>{children(session, logout)}</>

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <form onSubmit={handleLogin} className="flex w-full max-w-sm flex-col gap-4 rounded-panel border border-line bg-surface p-6 shadow-float">
        <div>
          <h1 className="text-base font-semibold text-fg">Modération</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Connecte-toi au jeu avec un compte modérateur, ou saisis le mot de passe d’administration.
          </p>
        </div>
        <Field
          label="Mot de passe d’administration"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
          error={error}
        />
        <Button type="submit" variant="primary" disabled={loading || !password}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </Button>
        <a href="/" className="text-center text-sm text-fg-muted underline underline-offset-2 hover:text-fg">Retour à la toile</a>
      </form>
    </main>
  )
}
