// ── Feature : Players ────────────────────────────────────────────────────────
// GET /api/leaderboard        → top joueurs par pixels posés
// GET /api/leaderboard/recent → feed des N derniers pixels posés

export async function playerRoutes(fastify, { pool }) {

  // Top joueurs — classés par nombre de pixels posés
  // GET /api/leaderboard?limit=20
  fastify.get('/api/leaderboard', async (req, reply) => {
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100)

    const result = await pool.query(
      `SELECT
         username,
         COUNT(*)::int                              AS pixels_placed,
         COUNT(DISTINCT color_id)::int              AS colors_used,
         MAX(placed_at)                             AS last_active,
         MIN(placed_at)                             AS first_active,
         MODE() WITHIN GROUP (ORDER BY color_id)::int AS favorite_color
       FROM pixel_history
       WHERE username IS NOT NULL
       GROUP BY username
       ORDER BY pixels_placed DESC
       LIMIT $1`,
      [limit]
    )

    const rows = result.rows.map((row, i) => ({ rank: i + 1, ...row }))
    reply.send({ leaderboard: rows, total: rows.length })
  })

  // Feed des derniers pixels posés
  // GET /api/leaderboard/recent?limit=50
  fastify.get('/api/leaderboard/recent', async (req, reply) => {
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200)

    const result = await pool.query(
      `SELECT x, y, color_id AS "colorId", username, source,
              placed_at AS "placedAt"
       FROM pixel_history
       WHERE username IS NOT NULL
       ORDER BY placed_at DESC
       LIMIT $1`,
      [limit]
    )

    reply.send({ recent: result.rows })
  })

  // Stats d'un joueur spécifique
  // GET /api/players/:username
  fastify.get('/api/players/:username', async (req, reply) => {
    const { username } = req.params

    const result = await pool.query(
      `SELECT
         COUNT(*)::int                              AS pixels_placed,
         COUNT(DISTINCT color_id)::int              AS colors_used,
         MAX(placed_at)                             AS last_active,
         MIN(placed_at)                             AS first_active,
         MODE() WITHIN GROUP (ORDER BY color_id)::int AS favorite_color
       FROM pixel_history
       WHERE LOWER(username) = LOWER($1)`,
      [username]
    )

    const row = result.rows[0]
    if (!row || row.pixels_placed === 0) {
      return reply.status(404).send({ error: 'Joueur introuvable' })
    }

    // Rang du joueur dans le leaderboard
    const rankResult = await pool.query(
      `SELECT COUNT(*)::int + 1 AS rank
       FROM (
         SELECT username, COUNT(*) AS total
         FROM pixel_history WHERE username IS NOT NULL
         GROUP BY username
         HAVING COUNT(*) > (
           SELECT COUNT(*) FROM pixel_history WHERE LOWER(username) = LOWER($1)
         )
       ) t`,
      [username]
    )

    reply.send({
      username,
      rank: rankResult.rows[0]?.rank ?? 1,
      ...row,
    })
  })

  // Coordonnées de tous les pixels actuellement posés par un joueur
  // GET /api/players/:username/pixels
  fastify.get('/api/players/:username/pixels', async (req, reply) => {
    const { username } = req.params

    const result = await pool.query(
      `SELECT DISTINCT ON (x, y) x, y, color_id AS "colorId"
       FROM pixel_history
       WHERE LOWER(username) = LOWER($1)
       ORDER BY x, y, placed_at DESC`,
      [username]
    )

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Aucun pixel trouvé pour ce joueur' })
    }

    reply.send({ username, pixels: result.rows, count: result.rows.length })
  })
}
