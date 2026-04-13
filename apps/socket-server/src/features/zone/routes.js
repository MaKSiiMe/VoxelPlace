// ── Feature : Zone ───────────────────────────────────────────────────────────
// GET /api/zone?x=&y=&w=&h=              → pixels actuels dans la zone
// GET /api/zone/history?x=&y=&w=&h=      → historique complet de la zone
// GET /api/zone/gif?x=&y=&w=&h=&fps=     → timelapse GIF de la zone

import gifenc from 'gifenc'
const { GIFEncoder, quantize, applyPalette } = gifenc
import { loadGrid } from '../canvas/grid.js'
import { PALETTE_RGB } from '../../shared/palette.js'

function parseZone(query, gridSize) {
  const x = Math.max(0, parseInt(query.x ?? '0', 10))
  const y = Math.max(0, parseInt(query.y ?? '0', 10))
  const w = Math.min(gridSize - x, Math.max(1, parseInt(query.w ?? '64', 10)))
  const h = Math.min(gridSize - y, Math.max(1, parseInt(query.h ?? '64', 10)))
  return { x, y, w, h }
}

export async function zoneRoutes(fastify, { pool, redis, gridSize }) {

  // État actuel de la zone
  // GET /api/zone?x=0&y=0&w=64&h=64
  fastify.get('/api/zone', async (req, reply) => {
    const { x, y, w, h } = parseZone(req.query, gridSize)

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
    const { x, y, w, h } = parseZone(req.query, gridSize)
    const limit = Math.min(parseInt(req.query.limit ?? '1000', 10), 10000)

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
    const { x, y, w, h } = parseZone(req.query, gridSize)
    const fps   = Math.min(Math.max(parseInt(req.query.fps   ?? '10', 10), 1), 30)
    const scale = Math.min(Math.max(parseInt(req.query.scale ?? '4',  10), 1), 16)

    const result = await pool.query(
      `SELECT x, y, color_id AS "colorId"
       FROM pixel_history
       WHERE x >= $1 AND x < $2 AND y >= $3 AND y < $4
       ORDER BY placed_at ASC
       LIMIT 50000`,
      [x, x + w, y, y + h]
    )

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Aucun pixel dans cette zone' })
    }

    const PIXELS_PER_FRAME = Math.max(1, Math.floor(result.rows.length / 200))
    const canvas = new Uint8Array(w * h)

    const width  = w * scale
    const height = h * scale
    const gif    = GIFEncoder()
    const delay  = Math.round(1000 / fps)

    for (let i = 0; i < result.rows.length; i++) {
      const { x: px, y: py, colorId } = result.rows[i]
      const lx = px - x
      const ly = py - y
      if (lx >= 0 && lx < w && ly >= 0 && ly < h) {
        canvas[ly * w + lx] = colorId & 0x0F
      }

      if ((i + 1) % PIXELS_PER_FRAME === 0 || i === result.rows.length - 1) {
        const rgba = new Uint8ClampedArray(width * height * 4)
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            const [r, g, b] = PALETTE_RGB[canvas[row * w + col] & 0x0F]
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                const idx = ((row * scale + sy) * width + (col * scale + sx)) * 4
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
      .header('Content-Disposition', `attachment; filename="voxelplace-zone-${x}-${y}-${w}x${h}.gif"`)
      .header('Content-Length', buffer.length)
      .send(Buffer.from(buffer))
  })
}
