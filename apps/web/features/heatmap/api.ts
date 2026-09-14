import { API_URL } from '@shared/api'

export type HeatmapPeriod = '1h' | '24h' | '7d' | 'all'

export interface Heatmap {
  /** Côté d'une case, en pixels de grille. */
  cell:   number
  /** Nombre de cases par côté. */
  size:   number
  max:    number
  total:  number
  counts: Uint16Array
}

export class HeatmapLockedError extends Error {
  constructor() { super('Heatmap à débloquer dans ta progression') }
}

/** Compteurs encodés en base64, 16 bits petit-boutistes. */
export function decodeCounts(base64: string): Uint16Array {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const view  = new DataView(bytes.buffer)
  const counts = new Uint16Array(bytes.length / 2)
  for (let i = 0; i < counts.length; i++) counts[i] = view.getUint16(i * 2, true)
  return counts
}

export async function fetchHeatmap(period: HeatmapPeriod, signal?: AbortSignal): Promise<Heatmap> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('voxelplace:token') ?? '' : ''
  const query = period === 'all' ? '' : `?since=${period}`
  const res = await fetch(`${API_URL}/api/heatmap${query}`, { headers: { Authorization: `Bearer ${token}` }, signal })
  if (res.status === 401 || res.status === 403) throw new HeatmapLockedError()
  if (!res.ok) throw new Error('Heatmap indisponible')
  const body = await res.json()
  return { cell: body.cell, size: body.size, max: body.max, total: body.total, counts: decodeCounts(body.counts) }
}
