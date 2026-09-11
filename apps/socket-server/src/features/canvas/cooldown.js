// ── Cooldown de pose de pixel ────────────────────────────────────────────────
// Détermine si un joueur a le droit de poser un pixel maintenant, selon son
// rôle et son streak. C'est la règle de jeu centrale de VoxelPlace.
//
// L'état vit en mémoire du process : un redémarrage de l'API remet tous les
// cooldowns à zéro, et deux instances laisseraient poser deux fois plus vite.
// Acceptable pour un déploiement mono-instance, à déplacer dans Redis le jour
// où l'API sera répliquée.

import { ROLE_COOLDOWNS } from '@voxelplace/types/roles'

const USER_TTL_MS   = 2 * 60 * 1000
const CLEANUP_MS    = 60_000
const PLACED_TTL_MS = 120_000

/** Réduction par streak pour les joueurs ordinaires : 0h=60s · 5h=45s · 10h=30s · 20h=20s */
export function cooldownForStreak(streakHours) {
  if (streakHours >= 20) return 20_000
  if (streakHours >= 10) return 30_000
  if (streakHours >= 5)  return 45_000
  return ROLE_COOLDOWNS.user
}


/**
 * Crée un contrôleur de cooldown isolé.
 *
 * @param {object}   pool           pool PostgreSQL
 * @param {Set}      testUsernames  comptes exemptés (bots internes)
 * @param {Function} now            horloge injectable, pour les tests
 */
export function createCooldownController({ pool, testUsernames = new Set(), now = Date.now } = {}) {
  const lastPlaced = new Map()  // username → timestamp de la dernière pose
  const userCache  = new Map()  // username → { data, fetchedAt }

  async function getUser(username) {
    const key    = username.toLowerCase()
    const cached = userCache.get(key)
    if (cached && now() - cached.fetchedAt < USER_TTL_MS) return cached.data

    try {
      const { rows } = await pool.query(
        'SELECT role, streak_hours FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      )
      const data = {
        role:   rows[0]?.role ?? 'user',
        streak: rows[0]?.streak_hours ?? 0,
        exists: rows.length > 0,
      }
      userCache.set(key, { data, fetchedAt: now() })
      return data
    } catch {
      // Base indisponible : on retombe sur le cooldown le plus strict plutôt
      // que de laisser passer les poses sans limite.
      return { role: 'user', streak: 0, exists: true }
    }
  }

  /**
   * @returns {{wait: number, cooldownMs: number}} wait = 0 → la pose est autorisée
   */
  async function check(username) {
    if (testUsernames.has(username)) return { wait: 0, cooldownMs: 0 }

    // Le rôle vient de la base, et d'elle seule : il était auparavant rehaussé
    // en superuser d'après le préfixe du pseudo.
    const { role, streak } = await getUser(username)

    let cooldownMs = ROLE_COOLDOWNS[role] ?? ROLE_COOLDOWNS.user
    if (role === 'user') cooldownMs = cooldownForStreak(streak)
    if (cooldownMs === 0) return { wait: 0, cooldownMs: 0 }

    const elapsed = now() - (lastPlaced.get(username) ?? 0)
    if (elapsed < cooldownMs) return { wait: cooldownMs - elapsed, cooldownMs }

    lastPlaced.set(username, now())
    return { wait: 0, cooldownMs }
  }

  /** Force le rechargement du rôle/streak au prochain appel. */
  function invalidate(username) {
    userCache.delete(username.toLowerCase())
  }

  /** Purge les entrées expirées — évite que les Map ne croissent sans fin. */
  function sweep() {
    const placedCutoff = now() - PLACED_TTL_MS
    for (const [user, ts] of lastPlaced) if (ts < placedCutoff) lastPlaced.delete(user)
    const cacheCutoff = now() - USER_TTL_MS
    for (const [user, entry] of userCache) if (entry.fetchedAt < cacheCutoff) userCache.delete(user)
  }

  // unref : ce minuteur ne doit jamais retenir le process (ni les tests) en vie
  const timer = setInterval(sweep, CLEANUP_MS)
  timer.unref?.()

  return { check, getUser, invalidate, sweep, stop: () => clearInterval(timer) }
}
