// ── Feature : Timelapse ──────────────────────────────────────────────────────
// GET /api/timelapse/gif    → GIF du timelapse de toute la toile (feature:timelapse_global)
//
// La route JSON /api/timelapse a été supprimée : aucun client ne l'appelait, et
// elle renvoyait tout l'historique en une réponse (9,8 Mo pour 200 000 poses).

import { parsePositiveInt } from '../../shared/query.js'
import { GRID_SIZE } from '../canvas/grid.js'
import { allowGif, sendTimelapseGif } from '../../shared/gif/reply.js'
import { requireFeature } from '../unlocks/feature-access.js'

export const TIMELAPSE_PERIODS = { '1h': '1 hour', '24h': '24 hours', '7d': '7 days', '30d': '30 days' }

/** Filtre SQL de période : liste blanche, la valeur est interpolée (INTERVAL n'accepte pas de paramètre). */
export function periodClause(since) {
  return since && TIMELAPSE_PERIODS[since] ? `placed_at > NOW() - INTERVAL '${TIMELAPSE_PERIODS[since]}'` : 'TRUE'
}

export async function timelapseRoutes(fastify, { pool, JWT_SECRET }) {

  // Génère et télécharge un GIF du timelapse de toute la toile
  // GET /api/timelapse/gif?fps=10&scale=1&since=24h
  // fps   : 1-30 (défaut: 10)
  // scale : agrandissement demandé, borné pour que l'image reste ≤ 1024 px de côté
  //         (la toile entière, 2048 px, est donc échantillonnée un pixel sur deux)
  // since : 1h | 24h | 7d | 30d | all (défaut: all)
  fastify.get('/api/timelapse/gif', async (req, reply) => {
    if (!allowGif(req, reply)) return
    if (!(await requireFeature(req, reply, { pool, jwtSecret: JWT_SECRET, nodeId: 'feature:timelapse_global' }))) return
    const fps   = parsePositiveInt(req.query.fps, 10, 30)
    const scale = parsePositiveInt(req.query.scale, 1, 8)

    const { rows } = await pool.query(
      `SELECT x, y, color_id AS "colorId"
       FROM pixel_history
       -- Effacements de modération compris : un contenu retiré ne doit pas revivre dans le GIF
       WHERE ${periodClause(req.query.since)}
       ORDER BY placed_at ASC
       LIMIT 100000`
    )

    await sendTimelapseGif(req, reply, {
      rows, zone: { x: 0, y: 0, w: GRID_SIZE, h: GRID_SIZE }, scale, fps,
      filename: `voxelplace-timelapse-${Date.now()}.gif`,
    })
  })
}
