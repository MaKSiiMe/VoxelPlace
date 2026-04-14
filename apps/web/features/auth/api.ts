const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export interface AuthResponse {
  token:    string
  username: string
  role:     string
}

export async function apiRegister(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
  return data
}

export async function apiLogin(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
  return data
}
