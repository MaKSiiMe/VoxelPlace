import { API_URL as API } from '@shared/api'

function token() {
  return typeof window !== 'undefined' ? (localStorage.getItem('voxelplace:token') ?? '') : ''
}

/**
 * Condition de déblocage. Pour un joueur connecté, le serveur y ajoute sa
 * progression : `met`, et pour les conditions chiffrées `current` / `target`.
 */
export interface Condition {
  type:     string
  colorId?: number
  nodeId?:  string
  min?:     number
  max?:     number
  met?:     boolean
  current?: number | null
  target?:  number
}

export interface TreeNode {
  nodeId:      string
  type:        'color' | 'feature'
  level:       number | null
  colorId:     number | null
  name:        string
  streakCost:  number
  /** Aucune interface ne la rend encore utilisable : ni déblocable, ni annoncée. */
  comingSoon:  boolean
  conditions:  Condition[]
  unlocked:    boolean
}

export interface TreeResponse {
  tree:         TreeNode[]
  /** Couleurs posables — celles d'un compte neuf pour un visiteur. */
  colors:       number[]
  /** null pour un visiteur. */
  streak_hours: number | null
}

export async function fetchTree(signal?: AbortSignal): Promise<TreeResponse> {
  const res = await fetch(`${API}/api/unlocks/tree`, {
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
    signal,
  })
  if (!res.ok) throw new Error('Progression indisponible')
  return res.json()
}

export async function unlockNode(nodeId: string): Promise<void> {
  const res = await fetch(`${API}/api/unlocks/${encodeURIComponent(nodeId)}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token()}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Déblocage impossible')
}
