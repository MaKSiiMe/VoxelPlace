import { API_URL as API } from '@shared/api'

export interface AuthResponse {
  token:    string
  username: string
  role:     string
}

const CSRF_HEADER = { 'X-Requested-With': 'XMLHttpRequest' }

export async function apiRegister(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...CSRF_HEADER },
    body:    JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
  return data
}

export async function apiLogin(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...CSRF_HEADER },
    body:    JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
  return data
}

/**
 * Droit à l'effacement : supprime le compte et détache ses pixels.
 * Le mot de passe est redemandé par le serveur pour confirmer l'intention.
 */
export async function apiDeleteAccount(token: string, password: string): Promise<void> {
  const res = await fetch(`${API}/api/auth/account`, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...CSRF_HEADER },
    body:    JSON.stringify({ password }),
  })
  if (res.ok) return
  const data = await res.json().catch(() => ({}))
  throw new Error(data.error ?? 'Erreur serveur')
}
