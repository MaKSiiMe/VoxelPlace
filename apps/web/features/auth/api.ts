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
