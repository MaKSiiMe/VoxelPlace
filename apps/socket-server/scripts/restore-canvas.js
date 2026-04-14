#!/usr/bin/env node
// ── Restaure le canvas Redis depuis pixel_history PostgreSQL ─────────────────
// Usage : node scripts/restore-canvas.js
// Lit le dernier pixel posé par coordonnée et reconstruit le buffer Redis.

import 'dotenv/config'
import pg    from 'pg'
import Redis from 'ioredis'

const GRID_SIZE  = 2048
const GRID_KEY   = 'voxelplace:grid'
const PIXELS_KEY = 'voxelplace:pixels'

const pool  = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const redis = new Redis(process.env.REDIS_URL)

async function main() {
  console.log('Connexion PostgreSQL…')
  await pool.query('SELECT 1')
  console.log('Connexion Redis…')
  await redis.ping()

  // Dernier pixel posé par coordonnée (colorId, username, placed_at)
  console.log('Lecture pixel_history…')
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (x, y)
      x, y, color_id AS "colorId", username, source, placed_at AS "placedAt"
    FROM pixel_history
    ORDER BY x, y, placed_at DESC
  `)

  console.log(`${rows.length} pixels à restaurer…`)

  if (rows.length === 0) {
    console.log('Aucun pixel en base — canvas laissé vide.')
    await cleanup()
    return
  }

  // Construit le buffer complet
  const grid = Buffer.alloc(GRID_SIZE * GRID_SIZE, 0)
  const pipe  = redis.pipeline()

  for (const row of rows) {
    const { x, y, colorId, username, source, placedAt } = row
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue

    const index = y * GRID_SIZE + x
    grid[index] = colorId & 0x0F

    const meta = JSON.stringify({ x, y, colorId, username, source, updatedAt: new Date(placedAt).getTime() })
    pipe.hset(PIXELS_KEY, `${x},${y}`, meta)
  }

  // Écrit le buffer d'un coup
  await redis.set(GRID_KEY, grid)
  // Écrit les métadonnées en pipeline
  await pipe.exec()

  console.log(`✅ Canvas restauré : ${rows.length} pixels injectés dans Redis.`)
  await cleanup()
}

async function cleanup() {
  await pool.end()
  redis.disconnect()
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
