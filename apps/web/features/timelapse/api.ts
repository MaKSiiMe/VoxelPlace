import { API_URL } from '@shared/api'

export type TimelapseScope  = 'me' | 'canvas'
export type TimelapsePeriod = '24h' | '7d' | '30d' | 'all'

export class TimelapseError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

const MESSAGES: Record<number, string> = {
  403: 'Ce timelapse est à débloquer dans ta progression.',
  404: 'Aucun pixel sur cette période.',
  429: 'Trop de timelapses demandés : réessaie dans une minute.',
  503: 'Un autre timelapse est en cours de génération : réessaie dans quelques secondes.',
}

export function timelapseUrl(scope: TimelapseScope, period: TimelapsePeriod, username: string): string {
  const path  = scope === 'me' ? `/api/players/${encodeURIComponent(username)}/gif` : '/api/timelapse/gif'
  const query = period === 'all' ? '' : `?since=${period}`
  return `${API_URL}${path}${query}`
}

/** Télécharge le GIF ; rejette avec un message prêt à afficher. */
export async function fetchTimelapse(scope: TimelapseScope, period: TimelapsePeriod, username: string, signal?: AbortSignal): Promise<Blob> {
  const token = localStorage.getItem('voxelplace:token') ?? ''
  const res = await fetch(timelapseUrl(scope, period, username), { headers: { Authorization: `Bearer ${token}` }, signal })
  if (!res.ok) throw new TimelapseError(MESSAGES[res.status] ?? 'Impossible de générer le timelapse.', res.status)
  return res.blob()
}
