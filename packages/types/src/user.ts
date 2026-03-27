export interface User {
  id: string
  username: string
  role: 'user' | 'admin'
  cooldownEnd?: number
}

export interface ConnectedPlayer {
  username: string
  source: Platform
}

export interface PlayersPayload {
  count: number
  byPlatform: Partial<Record<Platform, number>>
}
