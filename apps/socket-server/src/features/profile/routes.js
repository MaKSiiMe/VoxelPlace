// ── Feature : Profil public ──────────────────────────────────────────────────
// GET /api/profile/:username → stats publiques + unlocks si feature:profile débloquée

import { getUnlocks } from '../unlocks/engine.js'
import { TREE } from '../unlocks/tree.js'

export async function profileRoutes(fastify, { pool }) {

  // GET /api/profile/:username
  fastify.get('/api/profile/:username', async (req, reply) => {
    const { username } = req.params

    const userRow = await pool.query(
      `SELECT username, created_at, streak_hours, last_pixel_at
       FROM users WHERE LOWER(username) = LOWER($1)`,
      [username.trim()]
    )
    if (!userRow.rows[0]) {
      return reply.status(404).send({ error: 'Joueur introuvable' })
    }
    const user = userRow.rows[0]

    // Stats de base (top 100 + pixels placed)
    const statsRow = await pool.query(
      `SELECT pixels_placed, pixels_lost, pixels_overwritten,
              zones_visited, days_played
       FROM user_stats WHERE LOWER(username) = LOWER($1)`,
      [username.trim()]
    )
    const stats = statsRow.rows[0] ?? {
      pixels_placed: 0, pixels_lost: 0, pixels_overwritten: 0,
      zones_visited: 0, days_played: 0,
    }

    // Rang (classement par pixels placés)
    const rankRow = await pool.query(
      `SELECT COUNT(*) + 1 AS rank FROM user_stats
       WHERE pixels_placed > (
         SELECT COALESCE(pixels_placed, 0) FROM user_stats
         WHERE LOWER(username) = LOWER($1)
       )`,
      [username.trim()]
    )
    const rank = parseInt(rankRow.rows[0]?.rank ?? 1)

    // Unlocks du joueur
    const unlocked = await getUnlocks(pool, user.username)

    // Top 100 check : on expose le profil complet seulement si rang ≤ 100 ou feature:profile débloquée
    const isTop100 = rank <= 100
    const hasProfileFeature = unlocked.has('feature:profile')

    if (!isTop100 && !hasProfileFeature) {
      // Profil minimal
      return reply.send({
        username:      user.username,
        rank,
        pixels_placed: stats.pixels_placed,
        created_at:    user.created_at,
        public:        false,
      })
    }

    // Profil complet
    const unlockedList = [...unlocked].map(nodeId => ({
      nodeId,
      name: TREE[nodeId]?.name ?? nodeId,
      type: TREE[nodeId]?.type ?? 'unknown',
    }))

    // Couleur favorite (plus posée)
    const colorRow = await pool.query(
      `SELECT color_id, count FROM user_color_counts
       WHERE LOWER(username) = LOWER($1)
       ORDER BY count DESC LIMIT 1`,
      [username.trim()]
    )
    const favoriteColor = colorRow.rows[0]?.color_id ?? null

    reply.send({
      username:           user.username,
      rank,
      pixels_placed:      stats.pixels_placed,
      pixels_lost:        stats.pixels_lost,
      pixels_overwritten: stats.pixels_overwritten,
      zones_visited:      stats.zones_visited,
      days_played:        stats.days_played,
      streak_hours:       user.streak_hours ?? 0,
      last_pixel_at:      user.last_pixel_at,
      created_at:         user.created_at,
      favorite_color:     favoriteColor,
      unlocked:           unlockedList,
      public:             true,
    })
  })
}
