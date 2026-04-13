// ── Feature : Partage de zone ────────────────────────────────────────────────
// POST /api/share          → crée un lien de partage pour une zone
// GET  /api/share/:id      → récupère les infos d'une zone partagée
// GET  /api/share/:id/gif  → télécharge le GIF de la zone partagée

import gifenc from 'gifenc'
const { GIFEncoder, quantize, applyPalette } = gifenc
import { loadGrid } from '../canvas/grid.js'
import { PALETTE_RGB } from '../../shared/palette.js'

// Génère un ID court de 8 caractères alphanumériques
function generateId() {
  return Math.random().toString(36).slice(2, 10).padEnd(8, '0')
}

export async function shareRoutes(fastify, { pool, redis, gridSize }) {

  // Crée la table si elle n'existe pas encore (pour les DB déjà en production)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared_zones (
      id         CHAR(8)  PRIMARY KEY,
      x          SMALLINT NOT NULL,
      y          SMALLINT NOT NULL,
      w          SMALLINT NOT NULL,
      h          SMALLINT NOT NULL,
      label      VARCHAR(64),
      created_by VARCHAR(32),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP
    )
  `)

  // Purge les liens expirés — au démarrage puis toutes les heures
  async function purgeExpired() {
    const { rowCount } = await pool.query(
      'DELETE FROM shared_zones WHERE expires_at IS NOT NULL AND expires_at < NOW()'
    )
    if (rowCount > 0) console.log(`[share] ${rowCount} lien(s) expiré(s) supprimé(s)`)
  }
  await purgeExpired()
  setInterval(purgeExpired, 60 * 60 * 1000)

  // Crée un lien de partage
  // POST /api/share
  // Body : { x, y, w, h, label?, created_by?, expires_in_days? }
  fastify.post('/api/share', async (req, reply) => {
    const { label, created_by, expires_in_days } = req.body || {}
    const x = Math.max(0, parseInt(req.body?.x ?? 0, 10))
    const y = Math.max(0, parseInt(req.body?.y ?? 0, 10))
    const w = Math.min(gridSize - x, Math.max(1, parseInt(req.body?.w ?? 64, 10)))
    const h = Math.min(gridSize - y, Math.max(1, parseInt(req.body?.h ?? 64, 10)))

    // Limite à 20 liens permanents par utilisateur
    if (!expires_in_days && created_by) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM shared_zones
         WHERE created_by = $1 AND expires_at IS NULL`,
        [created_by]
      )
      if (rows[0].count >= 20) {
        return reply.status(429).send({ error: 'Limite de 20 liens permanents atteinte' })
      }
    }

    const id         = generateId()
    const expires_at = expires_in_days
      ? new Date(Date.now() + parseInt(expires_in_days, 10) * 86400000)
      : null

    await pool.query(
      `INSERT INTO shared_zones (id, x, y, w, h, label, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, x, y, w, h, label ?? null, created_by ?? null, expires_at]
    )

    reply.status(201).send({
      id,
      url:        `/share/${id}`,
      previewUrl: `/api/share/${id}/gif`,
      x, y, w, h,
      label:      label ?? null,
      expires_at: expires_at ?? null,
    })
  })

  // Infos d'une zone partagée + état actuel des pixels
  // GET /api/share/:id
  fastify.get('/api/share/:id', async (req, reply) => {
    const { id } = req.params

    const result = await pool.query(
      'SELECT * FROM shared_zones WHERE id = $1',
      [id]
    )

    const zone = result.rows[0]
    if (!zone) return reply.status(404).send({ error: 'Lien introuvable' })

    if (zone.expires_at && new Date(zone.expires_at) < new Date()) {
      return reply.status(410).send({ error: 'Ce lien a expiré' })
    }

    const { x, y, w, h } = zone
    const buf  = await loadGrid(redis)
    const grid = []
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        grid.push(buf[row * gridSize + col] ?? 0)
      }
    }

    reply.send({ ...zone, grid })
  })

  // GIF de la zone partagée
  // GET /api/share/:id/gif?fps=10&scale=4
  fastify.get('/api/share/:id/gif', async (req, reply) => {
    const { id } = req.params

    const result = await pool.query(
      'SELECT * FROM shared_zones WHERE id = $1',
      [id]
    )

    const zone = result.rows[0]
    if (!zone) return reply.status(404).send({ error: 'Lien introuvable' })

    if (zone.expires_at && new Date(zone.expires_at) < new Date()) {
      return reply.status(410).send({ error: 'Ce lien a expiré' })
    }

    const { x, y, w, h } = zone
    const fps   = Math.min(Math.max(parseInt(req.query.fps   ?? '10', 10), 1), 30)
    const scale = Math.min(Math.max(parseInt(req.query.scale ?? '4',  10), 1), 16)

    const pixels = await pool.query(
      `SELECT x, y, color_id AS "colorId"
       FROM pixel_history
       WHERE x >= $1 AND x < $2 AND y >= $3 AND y < $4
       ORDER BY placed_at ASC LIMIT 50000`,
      [x, x + w, y, y + h]
    )

    if (pixels.rows.length === 0) {
      return reply.status(404).send({ error: 'Aucun pixel dans cette zone' })
    }

    const PIXELS_PER_FRAME = Math.max(1, Math.floor(pixels.rows.length / 200))
    const canvas = new Uint8Array(w * h)
    const width  = w * scale
    const height = h * scale
    const gif    = GIFEncoder()
    const delay  = Math.round(1000 / fps)

    for (let i = 0; i < pixels.rows.length; i++) {
      const { x: px, y: py, colorId } = pixels.rows[i]
      const lx = px - x, ly = py - y
      if (lx >= 0 && lx < w && ly >= 0 && ly < h) {
        canvas[ly * w + lx] = colorId & 0x0F
      }

      if ((i + 1) % PIXELS_PER_FRAME === 0 || i === pixels.rows.length - 1) {
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
      .header('Content-Disposition', `attachment; filename="voxelplace-${id}.gif"`)
      .header('Content-Length', buffer.length)
      .send(Buffer.from(buffer))
  })
}
