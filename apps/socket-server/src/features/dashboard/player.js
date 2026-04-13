// ── Dashboard Joueur ─────────────────────────────────────────────────────────
// GET /api/players/:username/dashboard  → stats complètes du joueur
// GET /api/players/:username/timelapse  → données timelapse personnel
// GET /api/players/:username/gif        → GIF timelapse personnel

import gifenc from 'gifenc'
const { GIFEncoder, quantize, applyPalette } = gifenc
import { PALETTE_RGB } from '../../shared/palette.js'

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

  // GIF timelapse personnel — seulement les pixels du joueur, fond noir
  // GET /api/players/:username/gif?fps=10&scale=1
  fastify.get('/api/players/:username/gif', async (req, reply) => {
    const { username } = req.params
    const fps   = Math.min(Math.max(parseInt(req.query.fps   ?? '10', 10), 1), 30)
    const scale = Math.min(Math.max(parseInt(req.query.scale ?? '1',  10), 1), 8)

    const result = await pool.query(`
      SELECT x, y, color_id AS "colorId"
      FROM pixel_history
      WHERE LOWER(username) = LOWER($1)
      ORDER BY placed_at ASC
      LIMIT 50000
    `, [username])

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Aucun pixel trouvé pour ce joueur' })
    }

    const PIXELS_PER_FRAME = Math.max(1, Math.floor(result.rows.length / 200))
    const canvas = new Uint8Array(gridSize * gridSize) // fond = colorId 1 (noir)
    const width  = gridSize * scale
    const height = gridSize * scale
    const gif    = GIFEncoder()
    const delay  = Math.round(1000 / fps)

    for (let i = 0; i < result.rows.length; i++) {
      const { x, y, colorId } = result.rows[i]
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        canvas[y * gridSize + x] = colorId & 0x0F
      }

      if ((i + 1) % PIXELS_PER_FRAME === 0 || i === result.rows.length - 1) {
        const rgba = new Uint8ClampedArray(width * height * 4)
        for (let py = 0; py < gridSize; py++) {
          for (let px = 0; px < gridSize; px++) {
            const [r, g, b] = PALETTE_RGB[canvas[py * gridSize + px] & 0x0F]
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                const idx = ((py * scale + sy) * width + (px * scale + sx)) * 4
                rgba[idx] = r; rgba[idx + 1] = g; rgba[idx + 2] = b; rgba[idx + 3] = 255
              }
            }
          }
        }
        const palette = quantize(rgba, 256)
        const index   = applyPalette(rgba, palette)
        gif.writeFrame(index, width, height, { palette, delay })
      }
    }

    gif.finish()
    const buffer = gif.bytesView()

    reply
      .header('Content-Type', 'image/gif')
      .header('Content-Disposition', `attachment; filename="voxelplace-${username}.gif"`)
      .header('Content-Length', buffer.length)
      .send(Buffer.from(buffer))
  })
}
