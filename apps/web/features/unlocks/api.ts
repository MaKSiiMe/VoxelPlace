const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function token() {
  return typeof window !== 'undefined' ? (localStorage.getItem('voxelplace:token') ?? '') : ''
}

export interface TreeNode {
  nodeId:      string
  type:        'color' | 'feature'
  level:       number | null
  colorId:     number | null
  name:        string
  streakCost:  number
  conditions:  unknown[]
  unlocked:    boolean
}

export interface UnlocksData {
  unlocked:      string[]
  streak_hours:  number
  last_pixel_at: string | null
}

export async function fetchTree(): Promise<TreeNode[]> {
  const res = await fetch(`${API}/api/unlocks/tree`, {
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
  })
  const data = await res.json()
  return data.tree
}

export async function fetchUnlocks(): Promise<UnlocksData> {
  const res = await fetch(`${API}/api/unlocks`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw new Error('Non connecté')
  return res.json()
}

export async function fetchAvailable(): Promise<string[]> {
  const res = await fetch(`${API}/api/unlocks/available`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  const data = await res.json()
  return data.available
}

export async function unlockNode(nodeId: string): Promise<void> {
  const res = await fetch(`${API}/api/unlocks/${encodeURIComponent(nodeId)}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erreur')
}
