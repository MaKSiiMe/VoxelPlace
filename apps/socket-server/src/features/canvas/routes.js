// ── Feature : Canvas (lecture) ───────────────────────────────────────────────
// GET /api/grid                  → grille complète
// GET /api/grid/window           → fenêtre rectangulaire de la grille
// GET /api/pixel/:x/:y           → métadonnées d'un pixel
// GET /api/pixel/:x/:y/history   → historique d'un pixel (git blame)

import { loadGrid, getPixelMeta, GRID_SIZE } from './grid.js'
import { PALETTE_HEX as COLORS } from '../../shared/palette.js'
import { parseIntStrict } from '../../shared/query.js'

export async function canvasRoutes(fastify, { redis, pool }) {

  fastify.get('/api/grid', async (_req, reply) => {
    const buf = await loadGrid(redis)
    reply.send({ grid: Array.from(buf), size: GRID_SIZE, colors: COLORS })
  })

  // GET /api/grid/window?x=896&z=896&w=256&h=256
  fastify.get('/api/grid/window', async (req, reply) => {
    const x = parseIntStrict(req.query.x, 0)
    const z = parseIntStrict(req.query.z, 0)
    const w = parseIntStrict(req.query.w, 64)
    const h = parseIntStrict(req.query.h, 64)

    if ([x, z, w, h].some(Number.isNaN)) {
      return reply.status(400).send({ error: 'Paramètres x, z, w, h : entiers attendus' })
    }
    if (w <= 0 || h <= 0) {
      return reply.status(400).send({ error: 'Largeur et hauteur doivent être positives' })
    }

    const ox = Math.max(0, Math.min(GRID_SIZE - 1, x))
    const oz = Math.max(0, Math.min(GRID_SIZE - 1, z))
    const ww = Math.min(GRID_SIZE, w)
    const hh = Math.min(GRID_SIZE, h)

    const buf    = await loadGrid(redis)
    const window = new Array(ww * hh)
    for (let dz = 0; dz < hh; dz++) {
      for (let dx = 0; dx < ww; dx++) {
        const gx = ox + dx
        const gz = oz + dz
        // Hors grille → 0, plutôt qu'un undefined qui casserait le client
        window[dz * ww + dx] = (gx < GRID_SIZE && gz < GRID_SIZE)
          ? buf[gz * GRID_SIZE + gx]
          : 0
      }
    }
    reply.send({ grid: window, offsetX: ox, offsetZ: oz, width: ww, height: hh, colors: COLORS })
  })

  fastify.get('/api/pixel/:x/:y/history', async (req, reply) => {
    const x = parseIntStrict(req.params.x, NaN)
    const y = parseIntStrict(req.params.y, NaN)
    if (!inBounds(x, y)) return reply.status(400).send({ error: 'Coordonnées invalides' })

    const result = await pool.query(
      `SELECT color_id AS "colorId", username, source, placed_at AS "placedAt"
       FROM pixel_history WHERE x = $1 AND y = $2 ORDER BY placed_at DESC LIMIT 50`,
      [x, y]
    )
    reply.send({ x, y, history: result.rows })
  })

  fastify.get('/api/pixel/:x/:y', async (req, reply) => {
    const x = parseIntStrict(req.params.x, NaN)
    const y = parseIntStrict(req.params.y, NaN)
    if (!inBounds(x, y)) return reply.status(400).send({ error: 'Coordonnées invalides' })

    const meta = await getPixelMeta(redis, x, y)
    reply.send(meta || { x, y, colorId: 0, username: null, source: null })
  })
}

function inBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y)
      && x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE
}
