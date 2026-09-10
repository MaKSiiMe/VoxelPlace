// ── Feature : Analytics ──────────────────────────────────────────────────────
// GET /api/stats      → compteurs par plateforme
// GET /api/heatmap    → densité de poses par coordonnée
// GET /api/pulse      → activité par minute (3 dernières heures)
// GET /api/snapshot   → état du canvas à un instant donné
// GET /api/conflicts  → pixels repris par un autre joueur
// GET /api/history    → historique complet (timelapse)

import { getStats } from './stats.js'
import { GRID_SIZE } from '../canvas/grid.js'

// Fenêtres temporelles autorisées. Liste blanche : la valeur est interpolée
// dans le SQL (INTERVAL n'accepte pas de paramètre lié), donc rien d'autre
// que ces clés ne doit pouvoir atteindre la requête.
const INTERVALS = {
  '1h':  '1 hour',
  '24h': '24 hours',
  '7d':  '7 days',
  '30d': '30 days',
}

export async function analyticsRoutes(fastify, { pool, redis }) {

  fastify.get('/api/stats', async (_req, reply) => {
    reply.send(await getStats(redis))
  })

  // GET /api/heatmap?since=24h&username=Steve
  fastify.get('/api/heatmap', async (req, reply) => {
    const { since, username } = req.query
    if (since && !INTERVALS[since]) {
      return reply.status(400).send({ error: `Paramètre since invalide (attendu : ${Object.keys(INTERVALS).join(', ')})` })
    }

    const conditions = []
    const params     = []

    if (username) {
      params.push(username)
      conditions.push(`LOWER(username) = LOWER($${params.length})`)
    }
    if (since) {
      conditions.push(`placed_at > NOW() - INTERVAL '${INTERVALS[since]}'`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await pool.query(
      `SELECT x, y, COUNT(*)::int AS count FROM pixel_history ${where} GROUP BY x, y ORDER BY count DESC`,
      params
    )
    reply.send({ heatmap: result.rows, filters: { since: since ?? 'all', username: username ?? null } })
  })

  fastify.get('/api/pulse', async (_req, reply) => {
    const result = await pool.query(`
      SELECT date_trunc('minute', placed_at) AS t, COUNT(*)::int AS count
      FROM pixel_history
      WHERE placed_at > NOW() - INTERVAL '3 hours'
      GROUP BY t ORDER BY t
    `)
    reply.send({ pulse: result.rows })
  })

  fastify.get('/api/snapshot', async (req, reply) => {
    const { at } = req.query
    if (!at) return reply.status(400).send({ error: 'Paramètre "at" requis' })
    try {
      const result = await pool.query(`
        SELECT DISTINCT ON (x, y) x, y, color_id AS "colorId"
        FROM pixel_history
        WHERE placed_at <= $1
        ORDER BY x, y, placed_at DESC
      `, [at])
      const grid = new Array(GRID_SIZE * GRID_SIZE).fill(0)
      for (const { x, y, colorId } of result.rows) {
        grid[y * GRID_SIZE + x] = colorId
      }
      reply.send({ grid, size: GRID_SIZE, at })
    } catch {
      reply.status(400).send({ error: 'Timestamp invalide' })
    }
  })

  fastify.get('/api/conflicts', async (_req, reply) => {
    const result = await pool.query(`
      SELECT x, y, COUNT(*)::int AS count
      FROM (
        SELECT x, y, username,
               LAG(username) OVER (PARTITION BY x, y ORDER BY placed_at) AS prev_username
        FROM pixel_history
      ) t
      WHERE prev_username IS NOT NULL AND username != prev_username
      GROUP BY x, y
    `)
    reply.send({ conflicts: result.rows })
  })

  fastify.get('/api/history', async (req, reply) => {
    const raw   = Number(req.query.limit ?? 10000)
    const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 50000) : 10000
    const result = await pool.query(
      `SELECT x, y, color_id AS "colorId", username, source, placed_at AS "placedAt"
       FROM pixel_history ORDER BY placed_at ASC LIMIT $1`,
      [limit]
    )
    reply.send({ history: result.rows, total: result.rowCount })
  })
}
