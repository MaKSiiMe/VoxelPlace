// ── Couleurs utilisables par un joueur web ───────────────────────────────────
// Une couleur se pose si elle est débloquée dans l'arbre de progression. Les
// rôles de confiance (superuser, admin, superadmin) ont les 16 d'office : ce
// droit est calculé, jamais écrit en base, pour qu'un rôle retiré rende au
// joueur exactement sa progression réelle.
//
// Les ponts de jeu ne passent pas par ici : un joueur Minecraft n'a pas de
// compte, donc pas de progression. Il pose avec les blocs de béton de son
// inventaire, soit les 16 couleurs. Asymétrie assumée, documentée dans le README.

import { BASE_COLOR_IDS } from './tree.js'
import { logger } from '../../shared/logger.js'

export const PALETTE_SIZE      = 16
export const ALL_COLORS_ROLES  = new Set(['superuser', 'admin', 'superadmin'])
const ALL_COLORS               = Object.freeze([...Array(PALETTE_SIZE).keys()])

const CACHE_TTL_MS = 2 * 60 * 1000
const CLEANUP_MS   = 60_000

/**
 * @param {object}   pool  pool PostgreSQL
 * @param {Function} now   horloge injectable, pour les tests
 */
export function createColorAccess({ pool, now = Date.now } = {}) {
  const cache = new Map()  // pseudo en minuscules → { colors: Set<number>, fetchedAt }

  async function load(username) {
    const { rows } = await pool.query(`
      SELECT u.role, uu.node_id
      FROM users u
      LEFT JOIN user_unlocks uu ON uu.username = u.username AND uu.node_id LIKE 'color:%'
      WHERE LOWER(u.username) = LOWER($1)
    `, [username])

    if (rows.length === 0) return new Set(BASE_COLOR_IDS)
    if (ALL_COLORS_ROLES.has(rows[0].role)) return new Set(ALL_COLORS)

    const colors = new Set(BASE_COLOR_IDS)
    for (const { node_id } of rows) {
      if (!node_id) continue
      const id = Number(node_id.slice('color:'.length))
      if (Number.isInteger(id) && id >= 0 && id < PALETTE_SIZE) colors.add(id)
    }
    return colors
  }

  /** Couleurs que le joueur peut poser. */
  async function colorsOf(username) {
    const key    = username.toLowerCase()
    const cached = cache.get(key)
    if (cached && now() - cached.fetchedAt < CACHE_TTL_MS) return cached.colors

    try {
      const colors = await load(username)
      cache.set(key, { colors, fetchedAt: now() })
      return colors
    } catch (err) {
      // Base indisponible : les couleurs de base restent posables, sans mise
      // en cache — le jeu ne s'arrête pas, et rien n'est offert par erreur.
      logger.error({ err: err.message }, 'color-access')
      return new Set(BASE_COLOR_IDS)
    }
  }

  async function canUse(username, colorId) {
    return (await colorsOf(username)).has(colorId)
  }

  /** À appeler dès qu'une couleur est débloquée ou que le rôle change. */
  function invalidate(username) {
    cache.delete(username.toLowerCase())
  }

  function sweep() {
    const cutoff = now() - CACHE_TTL_MS
    for (const [key, entry] of cache) if (entry.fetchedAt < cutoff) cache.delete(key)
  }

  // unref : ce minuteur ne doit jamais retenir le process (ni les tests) en vie
  const timer = setInterval(sweep, CLEANUP_MS)
  timer.unref?.()

  return { colorsOf, canUse, invalidate, sweep, stop: () => clearInterval(timer) }
}
