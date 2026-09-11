import { API_URL } from '@shared/api'

export interface PixelReport {
  x:       number
  y:       number
  reason:  string
  /** Jeton du joueur connecté ; absent, le signalement est anonyme. */
  token?:  string | null
}

export async function submitPixelReport({ x, y, reason, token }: PixelReport): Promise<void> {
  const res = await fetch(`${API_URL}/api/report`, {
    method:  'POST',
    headers: {
      'Content-Type':     'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ target_type: 'pixel', x, y, reason }),
  })
  if (res.ok) return
  const data = await res.json().catch(() => ({}))
  throw new Error(data.error ?? 'Signalement impossible pour le moment')
}
