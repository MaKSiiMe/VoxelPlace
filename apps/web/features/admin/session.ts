import { getRoleFromToken, isTokenExpired } from '@features/auth/utils'

// Deux façons d'accéder au tableau de bord :
// - un compte joueur au rôle admin ou superadmin, déjà connecté au jeu ;
// - le mot de passe d'administration, qui délivre un jeton superadmin sans pseudo.
//
// Ce second jeton était rangé sous la clé du joueur : se connecter à
// l'administration déconnectait du jeu, et le jeu recevait un jeton sans
// pseudo, avec lequel aucun pixel ne pouvait être posé. Il a sa propre clé.

export const PLAYER_TOKEN_KEY = 'voxelplace:token'
export const ADMIN_TOKEN_KEY  = 'voxelplace:admin-token'

export type AdminRole = 'admin' | 'superadmin'

export interface AdminSession {
  token:    string
  role:     AdminRole
  /** null pour le jeton du mot de passe d'administration. */
  username: string | null
}

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function sessionFrom(token: string | null): AdminSession | null {
  if (!token || isTokenExpired(token)) return null
  const role = getRoleFromToken(token)
  if (role !== 'admin' && role !== 'superadmin') return null
  let username: string | null = null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    username = typeof payload?.username === 'string' ? payload.username : null
  } catch { /* jeton illisible : déjà écarté par getRoleFromToken */ }
  return { token, role, username }
}

/** Session d'administration active ; le jeton du mot de passe prime sur le compte joueur. */
export function getAdminSession(): AdminSession | null {
  return sessionFrom(read(ADMIN_TOKEN_KEY)) ?? sessionFrom(read(PLAYER_TOKEN_KEY))
}

export function storeAdminToken(token: string) {
  try { localStorage.setItem(ADMIN_TOKEN_KEY, token) } catch { /* stockage indisponible */ }
}

/** Oublie le jeton d'administration ; la session de jeu, elle, reste ouverte. */
export function clearAdminToken() {
  try { localStorage.removeItem(ADMIN_TOKEN_KEY) } catch { /* stockage indisponible */ }
}
