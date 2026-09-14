// ── Feature : Analytics ──────────────────────────────────────────────────────
// GET /api/stats      → compteurs par plateforme
// GET /api/heatmap    → densité de poses par case de 8 px (fonctionnalité débloquée)
// GET /api/pulse      → activité par minute (3 dernières heures)
// GET /api/snapshot   → état du canvas à un instant donné
// GET /api/conflicts  → pixels repris par un autre joueur
// GET /api/history    → historique complet (timelapse)

import { getStats } from './stats.js'
import { GRID_SIZE } from '../canvas/grid.js'
import { binHeatmap, encodeCounts, HEATMAP_CELL, HEATMAP_SIZE } from './heatmap.js'
import { requireFeature } from '../unlocks/feature-access.js'

const HEATMAP_CACHE_MS = 30_000

// Fenêtres temporelles autorisées. Liste blanche : la valeur est interpolée
// dans le SQL (INTERVAL n'accepte pas de paramètre lié), donc rien d'autre
// que ces clés ne doit pouvoir atteindre la requête.
const INTERVALS = {
  '1h':  '1 hour',
  '24h': '24 hours',
  '7d':  '7 days',
  '30d': '30 days',
}

export async function analyticsRoutes(fastify, { pool, redis, JWT_SECRET, now = Date.now }) {

  fastify.get('/api/stats', async (_req, reply) => {
    reply.send(await getStats(redis))
  })

  // Densité des poses, en cases de 8 × 8 pixels — fonctionnalité de l'arbre
  // GET /api/heatmap?since=24h   (1h | 24h | 7d | 30d, absent = tout l'historique)
  const heatmapCache = new Map()   // since → { body, at }
  fastify.get('/api/heatmap', async (req, reply) => {
    const { since } = req.query
    if (since && !INTERVALS[since]) {
      return reply.status(400).send({ error: `Paramètre since invalide (attendu : ${Object.keys(INTERVALS).join(', ')})` })
    }
    if (!(await requireFeature(req, reply, { pool, jwtSecret: JWT_SECRET, nodeId: 'feature:heatmap' }))) return

    // Chaque affichage parcourt l'historique : plusieurs joueurs qui ouvrent la
    // heatmap dans la même demi-minute partagent le même calcul.
    const key    = since ?? 'all'
    const cached = heatmapCache.get(key)
    if (cached && now() - cached.at < HEATMAP_CACHE_MS) return reply.send(cached.body)

    const { rows } = await pool.query(`
      SELECT x / ${HEATMAP_CELL} AS bx, y / ${HEATMAP_CELL} AS by, COUNT(*)::int AS count
      FROM pixel_history
      WHERE source IS DISTINCT FROM 'moderation'
      ${since ? `AND placed_at > NOW() - INTERVAL '${INTERVALS[since]}'` : ''}
      GROUP BY bx, by
    `)
    const { counts, max, total } = binHeatmap(rows)
    const body = { cell: HEATMAP_CELL, size: HEATMAP_SIZE, since: key, max, total, counts: encodeCounts(counts) }
    heatmapCache.set(key, { body, at: now() })
    reply.send(body)
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
