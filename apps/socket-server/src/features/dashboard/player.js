// ── Dashboard Joueur ─────────────────────────────────────────────────────────
// GET /api/players/:username/dashboard  → stats complètes du joueur
// GET /api/players/:username/timelapse  → données timelapse personnel
// GET /api/players/:username/gif        → GIF timelapse personnel

import { parsePositiveInt } from '../../shared/query.js'
import { allowGif, sendTimelapseGif } from '../../shared/gif/reply.js'

export async function playerDashboardRoutes(fastify, { pool, gridSize }) {

  // Dashboard complet d'un joueur
  // GET /api/players/:username/dashboard
  fastify.get('/api/players/:username/dashboard', async (req, reply) => {
    const { username } = req.params

    const [
      stats,
      streak,
      recentPixels,
      rivals,
      neighbors,
      intactPixels,
    ] = await Promise.all([

      // Stats de base
      pool.query(`
        SELECT
          COUNT(*)::int                               AS pixels_placed,
          COUNT(DISTINCT color_id)::int               AS colors_used,
          MAX(placed_at)                              AS last_active,
          MIN(placed_at)                              AS first_active,
          MODE() WITHIN GROUP (ORDER BY color_id)::int AS favorite_color
        FROM pixel_history
        WHERE LOWER(username) = LOWER($1)
      `, [username]),

      // Streak — nombre de jours consécutifs avec au moins 1 pixel posé
      pool.query(`
        WITH days AS (
          SELECT DISTINCT DATE(placed_at) AS day
          FROM pixel_history
          WHERE LOWER(username) = LOWER($1)
          ORDER BY day DESC
        ),
        streaks AS (
          SELECT day,
                 day - (ROW_NUMBER() OVER (ORDER BY day DESC))::int * INTERVAL '1 day' AS grp
          FROM days
        )
        SELECT COUNT(*)::int AS streak
        FROM streaks
        WHERE grp = (SELECT grp FROM streaks ORDER BY day DESC LIMIT 1)
      `, [username]),

      // 20 derniers pixels posés
      pool.query(`
        SELECT x, y, color_id AS "colorId", placed_at AS "placedAt"
        FROM pixel_history
        WHERE LOWER(username) = LOWER($1)
        ORDER BY placed_at DESC
        LIMIT 20
      `, [username]),

      // Rivaux — joueurs qui ont le plus écrasé les pixels de ce joueur
      pool.query(`
        SELECT
          ph2.username AS rival,
          COUNT(*)::int AS overwrites
        FROM pixel_history ph1
        JOIN pixel_history ph2
          ON ph1.x = ph2.x AND ph1.y = ph2.y
          AND ph2.placed_at > ph1.placed_at
          AND LOWER(ph2.username) != LOWER($1)
        WHERE LOWER(ph1.username) = LOWER($1)
          AND ph2.username IS NOT NULL
        GROUP BY rival
        ORDER BY overwrites DESC
        LIMIT 5
      `, [username]),

      // Voisins — joueurs qui posent souvent dans la même zone 32×32
      pool.query(`
        SELECT
          ph2.username AS neighbor,
          COUNT(*)::int AS shared_zone_pixels
        FROM pixel_history ph1
        JOIN pixel_history ph2
          ON (ph1.x / 32) = (ph2.x / 32)
          AND (ph1.y / 32) = (ph2.y / 32)
          AND LOWER(ph2.username) != LOWER($1)
        WHERE LOWER(ph1.username) = LOWER($1)
          AND ph2.username IS NOT NULL
        GROUP BY neighbor
        ORDER BY shared_zone_pixels DESC
        LIMIT 5
      `, [username]),

      // % de pixels encore intacts (jamais écrasés depuis la dernière pose du joueur)
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(CASE WHEN last_poster = LOWER($1) THEN 1 END)::int AS still_mine
        FROM (
          SELECT x, y, LOWER(username) AS last_poster
          FROM pixel_history
          WHERE (x, y, placed_at) IN (
            SELECT x, y, MAX(placed_at)
            FROM pixel_history
            GROUP BY x, y
          )
          AND LOWER(username) = LOWER($1)
        ) t
      `, [username]),

    ])

    const row = stats.rows[0]
    if (!row || row.pixels_placed === 0) {
      return reply.status(404).send({ error: 'Joueur introuvable' })
    }

    const intact = intactPixels.rows[0]
    const intactPct = intact.total > 0
      ? Math.round((intact.still_mine / intact.total) * 100)
      : 0

    reply.send({
      username,
      ...row,
      streak:        streak.rows[0]?.streak ?? 0,
      recent_pixels: recentPixels.rows,
      rivals:        rivals.rows,
      neighbors:     neighbors.rows,
      intact_pixels: { percent: intactPct, total: intact.total, still_mine: intact.still_mine },
    })
  })

  // Données timelapse personnel (frames JSON)
  // GET /api/players/:username/timelapse?interval=minute
  fastify.get('/api/players/:username/timelapse', async (req, reply) => {
    const { username } = req.params
    const interval = ['second', 'minute', 'hour', 'day'].includes(req.query.interval)
      ? req.query.interval : 'minute'

    const result = await pool.query(`
      SELECT
        date_trunc($1, placed_at) AS frame_time,
        json_agg(
          json_build_object('x', x, 'y', y, 'colorId', color_id)
          ORDER BY placed_at
        ) AS pixels
      FROM pixel_history
      WHERE LOWER(username) = LOWER($2)
      GROUP BY frame_time
      ORDER BY frame_time ASC
    `, [interval, username])

    reply.send({ username, frames: result.rows, total: result.rows.length, interval })
  })

  // GIF timelapse personnel — seulement les pixels du joueur
  // GET /api/players/:username/gif?fps=10&scale=1
  // Même moteur que les autres GIF (image ≤ 1024 px, 100 images, worker thread) :
  // cette route construisait encore la toile entière en RGBA à chaque image,
  // dans le thread principal, et gelait le serveur une vingtaine de secondes.
  fastify.get('/api/players/:username/gif', async (req, reply) => {
    if (!allowGif(req, reply)) return
    const { username } = req.params
    const fps   = parsePositiveInt(req.query.fps, 10, 30)
    const scale = parsePositiveInt(req.query.scale, 1, 8)

    const { rows } = await pool.query(`
      SELECT x, y, color_id AS "colorId"
      FROM pixel_history
      WHERE LOWER(username) = LOWER($1)
      ORDER BY placed_at ASC
      LIMIT 50000
    `, [username])

    await sendTimelapseGif(req, reply, {
      rows, zone: { x: 0, y: 0, w: gridSize, h: gridSize }, scale, fps,
      filename: `voxelplace-${username.replace(/[^\w-]/g, '_')}.gif`,
    })
  })
}
