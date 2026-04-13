// ── Feature : Timelapse ──────────────────────────────────────────────────────
// GET /api/timelapse        → historique groupé par frames
// GET /api/timelapse/gif    → génère et télécharge un GIF du timelapse

import gifenc from 'gifenc'
const { GIFEncoder, quantize, applyPalette } = gifenc
import { PALETTE_RGB } from '../../shared/palette.js'

export async function timelapseRoutes(fastify, { pool }) {

  // Données du timelapse groupées par intervalles de temps
  // GET /api/timelapse?interval=minute&limit=5000
  // interval : second | minute | hour | day (défaut: minute)
  fastify.get('/api/timelapse', async (req, reply) => {
    const limit    = Math.min(parseInt(req.query.limit ?? '5000', 10), 50000)
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

  // Génère et télécharge un GIF du timelapse
  // GET /api/timelapse/gif?fps=10&scale=4&since=24h
  // fps   : 1-30 (défaut: 10)
  // scale : 1-8  (défaut: 1) — taille d'un pixel en px dans le GIF
  // since : 1h | 24h | 7d | 30d | all (défaut: all)
  fastify.get('/api/timelapse/gif', async (req, reply) => {
    const fps   = Math.min(Math.max(parseInt(req.query.fps   ?? '10', 10), 1), 30)
    const scale = Math.min(Math.max(parseInt(req.query.scale ?? '1',  10), 1), 8)
    const since = req.query.since

    const intervals = { '1h': '1 hour', '24h': '24 hours', '7d': '7 days', '30d': '30 days' }
    const whereClause = since && intervals[since]
      ? `WHERE placed_at > NOW() - INTERVAL '${intervals[since]}'`
      : ''

    // Récupère tous les pixels dans l'ordre chronologique
    const result = await pool.query(
      `SELECT x, y, color_id AS "colorId"
       FROM pixel_history
       ${whereClause}
       ORDER BY placed_at ASC
       LIMIT 100000`
    )

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Aucun pixel dans cet intervalle' })
    }

    // Reconstruit le canvas frame par frame
    // On regroupe par tranches de N pixels pour ne pas faire 100k frames
    const PIXELS_PER_FRAME = Math.max(1, Math.floor(result.rows.length / 200))
    const GRID_SIZE = 2048
    const canvas = new Uint8Array(GRID_SIZE * GRID_SIZE) // colorId par pixel

    const width  = GRID_SIZE * scale
    const height = GRID_SIZE * scale

    const gif = GIFEncoder()
    const delay = Math.round(1000 / fps)

    // Palette GIF (256 couleurs max) — on utilise nos 8 couleurs + noir fond
    const gifPalette = PALETTE_RGB.map(([r, g, b]) => [r, g, b])
    // Complète à 8 entrées minimum requis par gifenc
    while (gifPalette.length < 8) gifPalette.push([0, 0, 0])

    let frameCount = 0

    for (let i = 0; i < result.rows.length; i++) {
      const { x, y, colorId } = result.rows[i]
      if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        canvas[y * GRID_SIZE + x] = colorId & 0x0F
      }

      // Émet une frame tous les PIXELS_PER_FRAME pixels
      if ((i + 1) % PIXELS_PER_FRAME === 0 || i === result.rows.length - 1) {
        // Construit le buffer RGBA de la frame
        const rgba = new Uint8ClampedArray(width * height * 4)
        for (let py = 0; py < GRID_SIZE; py++) {
          for (let px = 0; px < GRID_SIZE; px++) {
            const [r, g, b] = PALETTE_RGB[canvas[py * GRID_SIZE + px] & 0x0F]
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                const idx = ((py * scale + sy) * width + (px * scale + sx)) * 4
                rgba[idx]     = r
                rgba[idx + 1] = g
                rgba[idx + 2] = b
                rgba[idx + 3] = 255
              }
            }
          }
        }

        const palette = quantize(rgba, 256)
        const index   = applyPalette(rgba, palette)
        gif.writeFrame(index, width, height, { palette, delay })
        frameCount++
      }
    }

    gif.finish()
    const buffer = gif.bytesView()

    reply
      .header('Content-Type', 'image/gif')
      .header('Content-Disposition', `attachment; filename="voxelplace-timelapse-${Date.now()}.gif"`)
      .header('Content-Length', buffer.length)
      .send(Buffer.from(buffer))
  })
}
