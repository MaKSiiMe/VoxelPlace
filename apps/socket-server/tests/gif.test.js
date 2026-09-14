// Tests des timelapses GIF.
//
// Une seule requête anonyme sur /api/timelapse/gif gelait le serveur temps réel
// 23 s au volume de la production (214 poses), et scale=8 réclamait 1 Go par
// image : chaque route construisait une image RGBA pleine taille puis la
// quantifiait, dans le thread principal, jusqu'à 200 fois.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp } from './helpers/app.js'
import { FakeRedis } from './helpers/redis-fake.js'
import { planGif, timelapseFrames, posesFromRows, GIF_MAX_SIDE, GIF_MAX_FRAMES } from '../src/shared/gif/frames.js'
import { renderTimelapseGif, _isBusy } from '../src/shared/gif/render.js'
import { timelapseRoutes } from '../src/features/timelapse/routes.js'
import { zoneRoutes } from '../src/features/zone/routes.js'
import { loadGrid } from '../src/features/canvas/grid.js'
import { PALETTE_RGB } from '../src/shared/palette.js'
import { _resetAttempts } from '../src/features/auth/rate-limit.js'

// ── Lecture minimale d'un GIF : dimensions, palette globale, nombre d'images ──
function readGif(buf) {
  assert.equal(buf.subarray(0, 6).toString(), 'GIF89a')
  const width = buf.readUInt16LE(6), height = buf.readUInt16LE(8)
  const flags = buf[10]
  const gctSize = flags & 0x80 ? 3 * 2 ** ((flags & 7) + 1) : 0
  const palette = []
  for (let i = 0; i < gctSize; i += 3) palette.push([buf[13 + i], buf[14 + i], buf[15 + i]])
  let p = 13 + gctSize, frames = 0
  const skipSubBlocks = () => { while (buf[p] !== 0) p += buf[p] + 1; p++ }
  for (;;) {
    const block = buf[p++]
    if (block === 0x3B) break
    if (block === 0x21) { p++; skipSubBlocks(); continue }
    assert.equal(block, 0x2C, `bloc inattendu 0x${block?.toString(16)}`)
    const lflags = buf[p + 8]
    p += 9 + (lflags & 0x80 ? 3 * 2 ** ((lflags & 7) + 1) : 0)
    p++            // taille minimale des codes LZW
    skipSubBlocks()
    frames++
  }
  return { width, height, palette, frames }
}

// ── Fonctions pures ──────────────────────────────────────────────────────────

describe('planGif', () => {
  it('échantillonne la toile entière au lieu de l\'agrandir', () => {
    assert.deepEqual(planGif({ w: 2048, h: 2048, scale: 8 }), { step: 2, scale: 1, cols: 1024, rows: 1024, width: 1024, height: 1024 })
  })

  it('ramène le facteur d\'agrandissement sous la borne', () => {
    assert.equal(planGif({ w: 256, h: 256, scale: 16 }).scale, 4)
    assert.deepEqual(planGif({ w: 64, h: 32, scale: 4 }), { step: 1, scale: 4, cols: 64, rows: 32, width: 256, height: 128 })
  })

  it('ne dépasse jamais GIF_MAX_SIDE, quelle que soit la zone', () => {
    for (const w of [1, 7, 300, 1024, 1025, 2047, 2048]) {
      for (const h of [1, 513, 2048]) {
        for (const scale of [1, 3, 16]) {
          const plan = planGif({ w, h, scale })
          assert.ok(plan.width <= GIF_MAX_SIDE && plan.height <= GIF_MAX_SIDE, JSON.stringify({ w, h, scale, plan }))
          assert.ok(plan.width >= 1 && plan.height >= 1)
        }
      }
    }
  })
})

describe('timelapseFrames', () => {
  const poses = (list) => posesFromRows(list.map(([x, y, colorId]) => ({ x, y, colorId })))

  it('rejoue les poses dans l\'ordre et finit sur l\'état final', () => {
    const zone = { x: 10, y: 20, w: 2, h: 2 }
    const plan = planGif({ w: 2, h: 2, scale: 1 })
    const frames = [...timelapseFrames(poses([[10, 20, 5], [11, 21, 3], [10, 20, 7]]), zone, plan)]
    assert.equal(frames.length, 3)
    assert.deepEqual([...frames[0]], [5, 0, 0, 0])
    assert.deepEqual([...frames[2]], [7, 0, 0, 3], 'la dernière pose sur une case l\'emporte')
  })

  it('ignore les poses hors de la zone', () => {
    const plan = planGif({ w: 2, h: 1, scale: 1 })
    const [frame] = [...timelapseFrames(poses([[0, 0, 9], [50, 50, 4]]), { x: 0, y: 0, w: 2, h: 1 }, plan, 1)]
    assert.deepEqual([...frame], [9, 0])
  })

  it('agrandit chaque case en carré de scale × scale', () => {
    const plan = planGif({ w: 2, h: 1, scale: 2 })
    const [frame] = [...timelapseFrames(poses([[1, 0, 6]]), { x: 0, y: 0, w: 2, h: 1 }, plan)]
    assert.deepEqual([...frame], [0, 0, 6, 6, 0, 0, 6, 6])
  })

  it('échantillonne une case sur `step`', () => {
    const plan = { step: 2, scale: 1, cols: 2, rows: 1, width: 2, height: 1 }
    const [frame] = [...timelapseFrames(poses([[0, 0, 1], [1, 0, 2], [2, 0, 3]]), { x: 0, y: 0, w: 4, h: 2 }, plan, 1)]
    assert.deepEqual([...frame], [1, 3])
  })

  it('produit au plus maxFrames images, la dernière comprise', () => {
    const many = poses(Array.from({ length: 1000 }, (_, i) => [i % 4, 0, (i % 15) + 1]))
    const plan = planGif({ w: 4, h: 1, scale: 1 })
    const frames = [...timelapseFrames(many, { x: 0, y: 0, w: 4, h: 1 }, plan, 37)]
    assert.equal(frames.length, 37, 'tout le budget d\'images est utilisé')
    // Poses 996 à 999 : couleurs (i % 15) + 1
    assert.deepEqual([...frames.at(-1)], [7, 8, 9, 10], 'la dernière image montre l\'état final')
  })
})

// ── Routes et worker ─────────────────────────────────────────────────────────

let db, app, redis
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  redis = new FakeRedis()
  await loadGrid(redis)
  app = await buildTestApp([timelapseRoutes, zoneRoutes], { pool: db.pool, redis, gridSize: 2048 })
})
after(async () => { await app?.close(); await db?.cleanup() })
beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
  _resetAttempts()
})

const seed = (n, size = 2048) => db.pool.query(`
  INSERT INTO pixel_history (x, y, color_id, username, source, placed_at)
  SELECT (g::bigint * 7919) % $2, (g::bigint * 104729) % $2, g % 16, 'p', 'web', NOW() - (($1 - g) || ' seconds')::interval
  FROM generate_series(1, $1) g`, [n, size])

describe('GET /api/timelapse/gif', { skip: skip() }, () => {
  it('borne l\'image à 1024 px et 100 images, avec la palette du jeu', async () => {
    await seed(214)
    const res = await app.inject({ method: 'GET', url: '/api/timelapse/gif?scale=8' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['content-type'], 'image/gif')

    const gif = readGif(res.rawPayload)
    assert.equal(gif.width, GIF_MAX_SIDE)
    assert.equal(gif.height, GIF_MAX_SIDE)
    assert.equal(gif.frames, GIF_MAX_FRAMES)
    assert.deepEqual(gif.palette, PALETTE_RGB, 'palette fixe : ni quantification, ni couleur approchée')
  })

  it('ne gèle pas la boucle d\'événements pendant l\'encodage', async () => {
    // Couleurs et positions aléatoires : un motif régulier se compresse presque
    // sans calcul, et l'encodage resterait rapide même dans le thread principal.
    await db.pool.query(`
      INSERT INTO pixel_history (x, y, color_id, username, source, placed_at)
      SELECT (random() * 2047)::int, (random() * 2047)::int, (random() * 15)::int, 'p', 'web',
             NOW() - ((100000 - g) || ' seconds')::interval
      FROM generate_series(1, 100000) g`)
    let last = performance.now(), maxGap = 0
    const tick = setInterval(() => { const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now }, 5)
    const res = await app.inject({ method: 'GET', url: '/api/timelapse/gif' })
    // Un tour de minuteur avant d'arrêter la mesure : juste après un blocage, la
    // réponse se résout en micro-tâche, avant que l'intervalle ait pu constater
    // l'écart — sans cette attente, le test passait même avec un encodage bloquant.
    await new Promise((resolve) => setTimeout(resolve, 20))
    clearInterval(tick)
    assert.equal(res.statusCode, 200)
    // Encodé dans le thread principal, ce GIF bloque plus de 2 secondes
    assert.ok(maxGap < 1000, `boucle gelée ${Math.round(maxGap)} ms`)
  })

  it('refuse un second GIF simultané plutôt que d\'en empiler', async () => {
    await seed(2000)
    const [a, b] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/timelapse/gif' }),
      app.inject({ method: 'GET', url: '/api/timelapse/gif' }),
    ])
    const codes = [a.statusCode, b.statusCode].sort()
    assert.deepEqual(codes, [200, 503])
    assert.equal([a, b].find(r => r.statusCode === 503).headers['retry-after'], '5')
    assert.equal(_isBusy(), false, 'le verrou est rendu après l\'encodage')
  })

  it('limite le nombre de GIF par adresse', async () => {
    for (let i = 0; i < 5; i++) await app.inject({ method: 'GET', url: '/api/timelapse/gif' })
    assert.equal((await app.inject({ method: 'GET', url: '/api/timelapse/gif' })).statusCode, 429)
  })

  it('répond 404 sans pixel', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/api/timelapse/gif' })).statusCode, 404)
  })
})

describe('GET /api/zone/gif', { skip: skip() }, () => {
  it('borne la zone la plus grande au facteur maximal', async () => {
    await seed(500)
    const res = await app.inject({ method: 'GET', url: '/api/zone/gif?x=0&y=0&w=2048&h=2048&scale=16' })
    assert.equal(res.statusCode, 200)
    const gif = readGif(res.rawPayload)
    assert.ok(gif.width <= GIF_MAX_SIDE && gif.height <= GIF_MAX_SIDE, `${gif.width}×${gif.height}`)
  })

  it('agrandit une petite zone au facteur demandé', async () => {
    await seed(50, 32)
    const gif = readGif((await app.inject({ method: 'GET', url: '/api/zone/gif?x=0&y=0&w=32&h=16&scale=4' })).rawPayload)
    assert.equal(gif.width, 128)
    assert.equal(gif.height, 64)
  })
})

describe('renderTimelapseGif', { skip: skip() }, () => {
  it('abandonne un encodage trop long et libère la place', async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ x: i % 2048, y: (i * 7) % 2048, colorId: i % 16 }))
    await assert.rejects(renderTimelapseGif(rows, { x: 0, y: 0, w: 2048, h: 2048 }, { timeoutMs: 1 }), /trop longue/)
    assert.equal(_isBusy(), false)
    const { buffer } = await renderTimelapseGif(rows.slice(0, 10), { x: 0, y: 0, w: 16, h: 16 })
    assert.equal(readGif(buffer).width, 16, 'le verrou libéré, un nouvel encodage aboutit')
  })
})
