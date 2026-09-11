import { API_URL } from '@shared/api'

export interface PixelInfo {
  x:         number
  y:         number
  colorId:   number
  /** null : jamais posé, ou auteur ayant supprimé son compte. */
  username:  string | null
  source:    string | null
  updatedAt?: number
}

export interface PixelHistoryEntry {
  colorId:  number
  username: string | null
  source:   string | null
  placedAt: string
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchPixelInfo(x: number, y: number, signal?: AbortSignal) {
  return getJson<PixelInfo>(`${API_URL}/api/pixel/${x}/${y}`, signal)
}

export async function fetchPixelHistory(x: number, y: number, signal?: AbortSignal) {
  const { history } = await getJson<{ history: PixelHistoryEntry[] }>(`${API_URL}/api/pixel/${x}/${y}/history`, signal)
  return history
}
