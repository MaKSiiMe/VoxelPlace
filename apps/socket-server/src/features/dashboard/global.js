// ── Dashboard Global ─────────────────────────────────────────────────────────
// GET /api/dashboard → toutes les stats globales du canvas

export async function globalDashboardRoutes(fastify, { pool }) {

  fastify.get('/api/dashboard', async (_req, reply) => {
    const [
      topColor,
      peakHour,
      intactPixels,
      topActive,
      hotZone,
    ] = await Promise.all([

      // Couleur la plus utilisée sur tout le canvas
      pool.query(`
        SELECT color_id AS "colorId", COUNT(*)::int AS count
        FROM pixel_history
        GROUP BY color_id
        ORDER BY count DESC
        LIMIT 1
      `),

      // Heure de pointe (0-23) — heure UTC avec le plus de poses de tous les temps
      pool.query(`
        SELECT EXTRACT(HOUR FROM placed_at)::int AS hour, COUNT(*)::int AS count
        FROM pixel_history
        GROUP BY hour
        ORDER BY count DESC
        LIMIT 1
      `),

      // % de pixels jamais écrasés (posés une seule fois par un seul joueur)
      pool.query(`
        SELECT
          COUNT(DISTINCT (x, y))::float AS total_touched,
          COUNT(DISTINCT CASE WHEN touch_count = 1 THEN (x, y) END)::float AS never_overwritten
        FROM (
          SELECT x, y, COUNT(*) AS touch_count
          FROM pixel_history
          GROUP BY x, y
        ) t
      `),

      // Top 5 joueurs actifs sur les 5 dernières minutes
      pool.query(`
        SELECT username, COUNT(*)::int AS pixels_last_5min
        FROM pixel_history
        WHERE placed_at > NOW() - INTERVAL '5 minutes'
          AND username IS NOT NULL
        GROUP BY username
        ORDER BY pixels_last_5min DESC
        LIMIT 5
      `),

      // Zone 64×64 la plus active sur les 15 dernières minutes
      pool.query(`
        SELECT
          (x / 64) * 64 AS zone_x,
          (y / 64) * 64 AS zone_y,
          COUNT(*)::int  AS activity
        FROM pixel_history
        WHERE placed_at > NOW() - INTERVAL '15 minutes'
        GROUP BY zone_x, zone_y
        ORDER BY activity DESC
        LIMIT 1
      `),
    ])

    const intact = intactPixels.rows[0]
    const intactPct = intact.total_touched > 0
      ? Math.round((intact.never_overwritten / intact.total_touched) * 100)
      : 100

    reply.send({
      top_color:      topColor.rows[0]     ?? null,
      peak_hour:      peakHour.rows[0]     ?? null,
      intact_pixels:  { percent: intactPct, ...intact },
      top_active:     topActive.rows,
      hot_zone:       hotZone.rows[0]      ?? null,
    })
  })
}
