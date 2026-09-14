// ── Feature : Zone ───────────────────────────────────────────────────────────
// GET /api/zone?x=&y=&w=&h=              → pixels actuels dans la zone
// GET /api/zone/history?x=&y=&w=&h=      → historique complet de la zone
// GET /api/zone/gif?x=&y=&w=&h=&fps=     → timelapse GIF de la zone

import { loadGrid } from '../canvas/grid.js'
import { parseZone, parsePositiveInt } from '../../shared/query.js'
import { allowGif, sendTimelapseGif } from '../../shared/gif/reply.js'

export async function zoneRoutes(fastify, { pool, redis, gridSize }) {

  // État actuel de la zone
  // GET /api/zone?x=0&y=0&w=64&h=64
  fastify.get('/api/zone', async (req, reply) => {
    const zone = parseZone(req.query, gridSize)
    if (!zone) return reply.status(400).send({ error: 'Paramètres x, y, w, h : entiers attendus' })
    const { x, y, w, h } = zone

    const buf  = await loadGrid(redis)
    const grid = []
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        grid.push(buf[row * gridSize + col] ?? 0)
      }
    }

    reply.send({ x, y, w, h, grid })
  })

  // Historique complet de la zone
  // GET /api/zone/history?x=0&y=0&w=64&h=64&limit=1000
  fastify.get('/api/zone/history', async (req, reply) => {
    const zone = parseZone(req.query, gridSize)
    if (!zone) return reply.status(400).send({ error: 'Paramètres x, y, w, h : entiers attendus' })
    const { x, y, w, h } = zone
    const limit = parsePositiveInt(req.query.limit, 1000, 10000)

    const result = await pool.query(
      `SELECT x, y, color_id AS "colorId", username, source, placed_at AS "placedAt"
       FROM pixel_history
       WHERE x >= $1 AND x < $2 AND y >= $3 AND y < $4
       ORDER BY placed_at DESC
       LIMIT $5`,
      [x, x + w, y, y + h, limit]
    )

    reply.send({ x, y, w, h, history: result.rows, total: result.rowCount })
  })

  // Timelapse GIF de la zone
  // GET /api/zone/gif?x=0&y=0&w=64&h=64&fps=10&scale=4
  fastify.get('/api/zone/gif', async (req, reply) => {
    if (!allowGif(req, reply)) return
    const zone = parseZone(req.query, gridSize)
    if (!zone) return reply.status(400).send({ error: 'Paramètres x, y, w, h : entiers attendus' })
    const { x, y, w, h } = zone
    const fps   = parsePositiveInt(req.query.fps, 10, 30)
    const scale = parsePositiveInt(req.query.scale, 4, 16)

    const { rows } = await pool.query(
      `SELECT x, y, color_id AS "colorId"
       FROM pixel_history
       WHERE x >= $1 AND x < $2 AND y >= $3 AND y < $4
       ORDER BY placed_at ASC
       LIMIT 50000`,
      [x, x + w, y, y + h]
    )

    await sendTimelapseGif(req, reply, {
      rows, zone, scale, fps,
      filename: `voxelplace-zone-${x}-${y}-${w}x${h}.gif`,
    })
  })
}
