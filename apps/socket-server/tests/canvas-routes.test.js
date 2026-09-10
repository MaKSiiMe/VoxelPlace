// Tests d'intégration des routes de lecture du canvas et de santé.
//
// Régression couverte : /api/grid/window faisait parseInt sans vérifier NaN.
// Un ?x=abc produisait un NaN qui traversait tous les calculs d'index et
// renvoyait une fenêtre entièrement blanche — le client affichait un canvas
// vide au lieu de recevoir une erreur.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp } from './helpers/app.js'
import { FakeRedis } from './helpers/redis-fake.js'
import { canvasRoutes } from '../src/features/canvas/routes.js'
import { healthRoutes } from '../src/features/health/routes.js'
import { loadGrid, setPixel, GRID_SIZE } from '../src/features/canvas/grid.js'

let db, app, redis
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  redis = new FakeRedis()
  app = await buildTestApp([canvasRoutes, healthRoutes], { pool: db.pool, redis })
})

after(async () => {
  await app?.close()
  await db?.cleanup()
})

beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
  await redis.flushall()
})

const get = (url) => app.inject({ method: 'GET', url })

describe('GET /api/grid', { skip: skip() }, () => {
  it('renvoie la grille complète avec sa taille et sa palette', async () => {
    const res = await get('/api/grid')
    assert.equal(res.statusCode, 200)

    const body = res.json()
    assert.equal(body.size, GRID_SIZE)
    assert.equal(body.grid.length, GRID_SIZE * GRID_SIZE)
    assert.equal(body.colors.length, 16, 'la palette compte 16 couleurs')
  })

  it('reflète les pixels réellement posés', async () => {
    await loadGrid(redis)
    await setPixel(redis, { x: 3, y: 4, colorId: 11, username: 'Alice', source: 'web' })

    const body = (await get('/api/grid')).json()
    assert.equal(body.grid[4 * GRID_SIZE + 3], 11)
  })
})

describe('GET /api/grid/window', { skip: skip() }, () => {
  beforeEach(async () => {
    if (db.skipped) return
    await loadGrid(redis)
    await setPixel(redis, { x: 100, y: 100, colorId: 7, username: 'Alice', source: 'web' })
  })

  it('renvoie la fenêtre demandée', async () => {
    const body = (await get('/api/grid/window?x=100&z=100&w=2&h=2')).json()
    assert.equal(body.width,  2)
    assert.equal(body.height, 2)
    assert.equal(body.grid.length, 4)
    assert.equal(body.grid[0], 7, 'le coin de la fenêtre est le pixel posé')
  })

  it('rejette un paramètre non numérique au lieu de renvoyer une fenêtre vide', async () => {
    const res = await get('/api/grid/window?x=abc&z=0&w=2&h=2')
    assert.equal(res.statusCode, 400)
    assert.match(res.json().error, /entiers attendus/)
  })

  it('rejette une largeur ou une hauteur nulle ou négative', async () => {
    assert.equal((await get('/api/grid/window?x=0&z=0&w=0&h=2')).statusCode,  400)
    assert.equal((await get('/api/grid/window?x=0&z=0&w=2&h=-5')).statusCode, 400)
  })

  it('applique les valeurs par défaut sans paramètres', async () => {
    const body = (await get('/api/grid/window')).json()
    assert.equal(body.width,  64)
    assert.equal(body.height, 64)
    assert.equal(body.grid.length, 64 * 64)
  })

  it('comble de zéros ce qui dépasse la grille, sans undefined', async () => {
    const body = (await get(`/api/grid/window?x=${GRID_SIZE - 2}&z=${GRID_SIZE - 2}&w=4&h=4`)).json()
    assert.equal(body.grid.length, 16)
    assert.ok(body.grid.every(v => typeof v === 'number'), 'aucune case ne doit être undefined')
  })
})

describe('GET /api/pixel/:x/:y', { skip: skip() }, () => {
  it('renvoie les métadonnées du pixel posé', async () => {
    await loadGrid(redis)
    await setPixel(redis, { x: 8, y: 9, colorId: 2, username: 'Bob', source: 'minecraft' })

    const body = (await get('/api/pixel/8/9')).json()
    assert.equal(body.username, 'Bob')
    assert.equal(body.source,   'minecraft')
    assert.equal(body.colorId,  2)
  })

  it('renvoie un pixel blanc sans propriétaire si rien n\'a été posé', async () => {
    const body = (await get('/api/pixel/500/500')).json()
    assert.equal(body.colorId,  0)
    assert.equal(body.username, null)
  })

  it('rejette des coordonnées hors grille ou non numériques', async () => {
    assert.equal((await get('/api/pixel/-1/0')).statusCode,   400)
    assert.equal((await get(`/api/pixel/${GRID_SIZE}/0`)).statusCode, 400)
    assert.equal((await get('/api/pixel/abc/0')).statusCode,  400)
  })
})

describe('GET /api/pixel/:x/:y/history', { skip: skip() }, () => {
  it('renvoie l\'historique du plus récent au plus ancien', async () => {
    await db.pool.query(
      `INSERT INTO pixel_history (x,y,color_id,username,source,placed_at) VALUES
       (5,5,1,'Alice','web',   NOW() - INTERVAL '2 hours'),
       (5,5,2,'Bob',  'minecraft', NOW() - INTERVAL '1 hour')`
    )
    const body = (await get('/api/pixel/5/5/history')).json()
    assert.equal(body.history.length, 2)
    assert.equal(body.history[0].username, 'Bob', 'le plus récent en premier')
  })

  it('renvoie un historique vide pour un pixel jamais touché', async () => {
    assert.deepEqual((await get('/api/pixel/7/7/history')).json().history, [])
  })
})

describe('GET /health', { skip: skip() }, () => {
  it('signale ok quand Redis et PostgreSQL répondent', async () => {
    const res = await get('/health')
    assert.equal(res.statusCode, 200)

    const body = res.json()
    assert.equal(body.status,        'ok')
    assert.equal(body.deps.redis,    'ok')
    assert.equal(body.deps.postgres, 'ok')
    assert.ok(typeof body.uptime_s === 'number')
  })

  it('renvoie 503 et pointe la dépendance fautive quand Redis est tombé', async () => {
    redis.setFailing(true)
    const res = await get('/health')
    assert.equal(res.statusCode, 503)

    const body = res.json()
    assert.equal(body.status,        'degraded')
    assert.equal(body.deps.redis,    'down')
    assert.equal(body.deps.postgres, 'ok', 'PostgreSQL doit rester signalé sain')
  })
})
