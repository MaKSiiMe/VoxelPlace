// ── Feature : Partage de zone ────────────────────────────────────────────────
// POST /api/share          → crée un lien de partage pour une zone
// GET  /api/share/:id      → récupère les infos d'une zone partagée
// GET  /api/share/:id/gif  → télécharge le GIF de la zone partagée

import { randomBytes } from 'node:crypto'
import gifenc from 'gifenc'
const { GIFEncoder, quantize, applyPalette } = gifenc
import { loadGrid } from '../canvas/grid.js'
import { PALETTE_RGB } from '../../shared/palette.js'
import { parseZone, parsePositiveInt } from '../../shared/query.js'

// Identifiant public de 8 caractères. Math.random() n'est pas imprévisible :
// les liens d'un utilisateur pourraient être devinés à partir des siens.
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function generateId() {
  const bytes = randomBytes(8)
  let id = ''
  for (const b of bytes) id += ID_ALPHABET[b % ID_ALPHABET.length]
  return id
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
  // unref : cette purge horaire ne doit pas empêcher le process (ni une suite
  // de tests) de se terminer.
  setInterval(purgeExpired, 60 * 60 * 1000).unref()

  // Crée un lien de partage
  // POST /api/share
  // Body : { x, y, w, h, label?, created_by?, expires_in_days? }
  fastify.post('/api/share', async (req, reply) => {
    const { label, created_by, expires_in_days } = req.body || {}
    const zone = parseZone(req.body ?? {}, gridSize)
    if (!zone) return reply.status(400).send({ error: 'Paramètres x, y, w, h : entiers attendus' })
    const { x, y, w, h } = zone

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

    const days       = Number(expires_in_days)
    const expires_at = Number.isInteger(days) && days > 0
      ? new Date(Date.now() + days * 86400000)
      : null

    // Réessaie en cas de collision d'identifiant : sans cela, la violation de
    // clé primaire remonterait en erreur 500 au lieu d'un simple nouveau tirage.
    let id
    for (let attempt = 0; ; attempt++) {
      id = generateId()
      try {
        await pool.query(
          `INSERT INTO shared_zones (id, x, y, w, h, label, created_by, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, x, y, w, h, label ?? null, created_by ?? null, expires_at]
        )
        break
      } catch (err) {
        // 23505 = violation de contrainte unique
        if (err.code !== '23505' || attempt >= 4) throw err
      }
    }

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
    const fps   = parsePositiveInt(req.query.fps, 10, 30)
    const scale = parsePositiveInt(req.query.scale, 4, 16)

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
