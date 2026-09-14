import { API_URL } from '@shared/api'
import { getAdminSession } from './session'

export class AdminApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const token = getAdminSession()?.token ?? ''
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      // Fastify répond 400 à un content-type JSON sans corps
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new AdminApiError(data.error ?? `Erreur ${res.status}`, res.status)
  return data as T
}

// ── Types renvoyés par le serveur ────────────────────────────────────────────

export type ReportStatus = 'pending' | 'reviewed' | 'all'

export interface Report {
  id:              number
  reporter:        string | null
  target_type:     'pixel' | 'player'
  target_username: string | null
  x:               number | null
  y:               number | null
  reason:          string | null
  status:          'pending' | 'reviewed'
  reviewed_by:     string | null
  reviewed_at:     string | null
  created_at:      string
}

export interface Ban {
  username:   string
  reason:     string | null
  banned_by:  string | null
  banned_at:  string
  expires_at: string | null
  active:     boolean
}

export type Role = 'user' | 'superuser' | 'admin' | 'superadmin'

export interface AdminUser {
  username:       string
  role:           Role
  created_at:     string
  banned:         boolean
  ban_reason:     string | null
  ban_expires_at: string | null
}

export interface ModerationLog {
  id:         number
  action:     string
  target:     string | null
  admin:      string
  reason:     string | null
  metadata:   Record<string, unknown> | null
  created_at: string
}

export interface Dashboard {
  global: {
    total_pixels:         number
    unique_players:       number
    unique_cells:         number
    last_activity:        string | null
    pixels_today:         number
    unique_players_today: number
    connected_now:        number
    bans_total:           number
  }
  by_platform: { source: string; pixels: number }[]
  hourly_24h:  { hour: string; pixels: number; active_players: number }[]
  top_players: { username: string; pixels: number; source: string }[]
}

// ── Appels ───────────────────────────────────────────────────────────────────

export const adminApi = {
  login: async (password: string) => {
    const res = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new AdminApiError(data.error ?? 'Mot de passe incorrect', res.status)
    return data as { token: string }
  },

  reports:      (status: ReportStatus, signal?: AbortSignal) =>
    request<{ reports: Report[] }>('GET', `/api/admin/reports?status=${status}&limit=200`, undefined, signal).then(d => d.reports),
  reviewReport: (id: number) => request<{ ok: true }>('PATCH', `/api/admin/reports/${id}`, {}),

  bans:  (signal?: AbortSignal) => request<{ bans: Ban[] }>('GET', '/api/admin/bans', undefined, signal).then(d => d.bans),
  ban:   (username: string, reason: string, days: number | null) =>
    request<{ ok: true }>('POST', `/api/admin/ban/${encodeURIComponent(username)}`, {
      ...(reason.trim() && { reason: reason.trim() }),
      ...(days !== null && { expires_in_days: days }),
    }),
  unban: (username: string) => request<{ ok: true }>('DELETE', `/api/admin/ban/${encodeURIComponent(username)}`),

  users:   (q: string, signal?: AbortSignal) =>
    request<{ users: AdminUser[] }>('GET', `/api/admin/users?q=${encodeURIComponent(q)}`, undefined, signal).then(d => d.users),
  setRole: (username: string, role: Role) =>
    request<{ ok: true }>('PATCH', `/api/admin/users/${encodeURIComponent(username)}/role`, { role }),

  logs: (action: string, signal?: AbortSignal) =>
    request<{ logs: ModerationLog[] }>('GET', `/api/admin/logs?limit=200${action ? `&action=${encodeURIComponent(action)}` : ''}`, undefined, signal).then(d => d.logs),

  dashboard: (signal?: AbortSignal) => request<Dashboard>('GET', '/api/admin/dashboard', undefined, signal),

  clearPixel:    (x: number, y: number) => request<{ ok: true; previousOwner: string | null }>('POST', '/api/admin/pixel/clear', { x, y }),
  restoreCanvas: () => request<{ ok: true; restored: number }>('POST', '/api/admin/restore-canvas'),
  clearCanvas:   () => request<{ ok: true; cleared: number }>('DELETE', '/api/admin/canvas'),
}
