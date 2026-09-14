// ── Feature : Timelapse ──────────────────────────────────────────────────────
// GET /api/timelapse        → historique groupé par frames
// GET /api/timelapse/gif    → génère et télécharge un GIF du timelapse

import { parsePositiveInt } from '../../shared/query.js'
import { GRID_SIZE } from '../canvas/grid.js'
import { allowGif, sendTimelapseGif } from '../../shared/gif/reply.js'

export async function timelapseRoutes(fastify, { pool }) {

  // Données du timelapse groupées par intervalles de temps
  // GET /api/timelapse?interval=minute&limit=5000
  // interval : second | minute | hour | day (défaut: minute)
  fastify.get('/api/timelapse', async (req, reply) => {
    const limit    = parsePositiveInt(req.query.limit, 5000, 50000)
    const interval = ['second', 'minute', 'hour', 'day'].includes(req.query.interval)
      ? req.query.interval
      : 'minute'

    const result = await pool.query(
      `SELECT
         date_trunc($1, placed_at) AS frame_time,
         json_agg(
           json_build_object('x', x, 'y', y, 'colorId', color_id, 'username', username)
           ORDER BY placed_at
         ) AS pixels
       FROM pixel_history
       GROUP BY frame_time
       ORDER BY frame_time ASC
       LIMIT $2`,
      [interval, limit]
    )

    reply.send({ frames: result.rows, total: result.rows.length, interval })
  })

  // Génère et télécharge un GIF du timelapse de toute la toile
  // GET /api/timelapse/gif?fps=10&scale=1&since=24h
  // fps   : 1-30 (défaut: 10)
  // scale : agrandissement demandé, borné pour que l'image reste ≤ 1024 px de côté
  //         (la toile entière, 2048 px, est donc échantillonnée un pixel sur deux)
  // since : 1h | 24h | 7d | 30d | all (défaut: all)
  fastify.get('/api/timelapse/gif', async (req, reply) => {
    if (!allowGif(req, reply)) return
    const fps   = parsePositiveInt(req.query.fps, 10, 30)
    const scale = parsePositiveInt(req.query.scale, 1, 8)
    const since = req.query.since

    const intervals = { '1h': '1 hour', '24h': '24 hours', '7d': '7 days', '30d': '30 days' }
    const whereClause = since && intervals[since]
      ? `WHERE placed_at > NOW() - INTERVAL '${intervals[since]}'`
      : ''

    const { rows } = await pool.query(
      `SELECT x, y, color_id AS "colorId"
       FROM pixel_history
       ${whereClause}
       ORDER BY placed_at ASC
       LIMIT 100000`
    )

    await sendTimelapseGif(req, reply, {
      rows, zone: { x: 0, y: 0, w: GRID_SIZE, h: GRID_SIZE }, scale, fps,
      filename: `voxelplace-timelapse-${Date.now()}.gif`,
    })
  })
}
