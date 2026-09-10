// Tests des zones et des liens de partage — la surface publique du canvas.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp } from './helpers/app.js'
import { FakeRedis } from './helpers/redis-fake.js'
import { zoneRoutes } from '../src/features/zone/routes.js'
import { shareRoutes } from '../src/features/share/routes.js'
import { loadGrid, setPixel, GRID_SIZE } from '../src/features/canvas/grid.js'
import { parseZone, parseIntStrict, parsePositiveInt } from '../src/shared/query.js'

let db, app, redis
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  redis = new FakeRedis()
  app = await buildTestApp([zoneRoutes, shareRoutes], { pool: db.pool, redis, gridSize: GRID_SIZE })
})

after(async () => {
  await app?.close()
  await db?.cleanup()
})

beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
  await redis.flushall()
  await loadGrid(redis)
})

const get  = (url)   => app.inject({ method: 'GET',  url })
const post = (url, payload) => app.inject({ method: 'POST', url, payload })

describe('helpers de requête', () => {
  it('parseIntStrict distingue absent, valide et invalide', () => {
    assert.equal(parseIntStrict(undefined, 42), 42)
    assert.equal(parseIntStrict('', 42),        42)
    assert.equal(parseIntStrict('7', 42),        7)
    assert.ok(Number.isNaN(parseIntStrict('abc', 42)))
    assert.ok(Number.isNaN(parseIntStrict('1.5', 42)))
  })

  it('parsePositiveInt retombe sur la valeur par défaut et respecte le plafond', () => {
    assert.equal(parsePositiveInt('abc', 100, 500), 100)
    assert.equal(parsePositiveInt('0',   100, 500), 100)
    assert.equal(parsePositiveInt('-5',  100, 500), 100)
    assert.equal(parsePositiveInt('50',  100, 500),  50)
    assert.equal(parsePositiveInt('9999', 100, 500), 500)
  })

  it('parseZone borne le rectangle à la grille', () => {
    const zone = parseZone({ x: '-10', y: '0', w: '100', h: '100' }, 2048)
    assert.equal(zone.x, 0, 'une abscisse négative est ramenée à 0')

    const edge = parseZone({ x: '2040', y: '0', w: '100', h: '10' }, 2048)
    assert.equal(edge.w, 8, 'la largeur ne peut pas dépasser le bord')
  })

  it('parseZone renvoie null sur un paramètre non entier', () => {
    assert.equal(parseZone({ x: 'abc' }, 2048), null)
  })
})

describe('GET /api/zone', { skip: skip() }, () => {
  it('renvoie les pixels du rectangle demandé', async () => {
    await setPixel(redis, { x: 5, y: 5, colorId: 7, username: 'Alice', source: 'web' })

    const body = (await get('/api/zone?x=5&y=5&w=2&h=2')).json()
    assert.equal(body.grid.length, 4)
    assert.equal(body.grid[0], 7)
  })

  it('rejette des paramètres non entiers au lieu de servir une zone vide', async () => {
    assert.equal((await get('/api/zone?x=abc&y=0&w=2&h=2')).statusCode, 400)
  })

  it('applique les valeurs par défaut sans paramètres', async () => {
    const body = (await get('/api/zone')).json()
    assert.equal(body.w, 64)
    assert.equal(body.grid.length, 64 * 64)
  })
})

describe('GET /api/zone/history', { skip: skip() }, () => {
  it('ne renvoie que les poses situées dans la zone', async () => {
    await db.pool.query(`
      INSERT INTO pixel_history (x,y,color_id,username,source) VALUES
      (5,5,1,'Alice','web'), (500,500,2,'Bob','web')
    `)
    const body = (await get('/api/zone/history?x=0&y=0&w=64&h=64')).json()
    assert.equal(body.history.length, 1)
    assert.equal(body.history[0].username, 'Alice')
  })

  it('tolère un limit invalide', async () => {
    assert.equal((await get('/api/zone/history?x=0&y=0&w=8&h=8&limit=abc')).statusCode, 200)
  })
})

describe('POST /api/share', { skip: skip() }, () => {
  it('crée un lien et renvoie son identifiant', async () => {
    const res = await post('/api/share', { x: 10, y: 10, w: 32, h: 32, label: 'Ma zone' })
    assert.equal(res.statusCode, 201)

    const body = res.json()
    assert.equal(body.id.length, 8)
    assert.equal(body.url, `/share/${body.id}`)
  })

  it('génère des identifiants distincts et imprévisibles', async () => {
    const ids = new Set()
    for (let i = 0; i < 20; i++) {
      ids.add((await post('/api/share', { x: 0, y: 0, w: 8, h: 8 })).json().id)
    }
    assert.equal(ids.size, 20, 'aucun identifiant ne doit se répéter')
  })

  it('rejette des coordonnées non entières', async () => {
    assert.equal((await post('/api/share', { x: 'abc', y: 0, w: 8, h: 8 })).statusCode, 400)
  })

  it('enregistre une expiration pour un lien temporaire', async () => {
    const { id } = (await post('/api/share', { x: 0, y: 0, w: 8, h: 8, expires_in_days: 7 })).json()
    const { rows } = await db.pool.query('SELECT expires_at FROM shared_zones WHERE id = $1', [id])
    assert.ok(rows[0].expires_at > new Date())
  })

  it('ignore une durée d\'expiration invalide plutôt que d\'enregistrer une date absurde', async () => {
    const { id } = (await post('/api/share', { x: 0, y: 0, w: 8, h: 8, expires_in_days: 'abc' })).json()
    const { rows } = await db.pool.query('SELECT expires_at FROM shared_zones WHERE id = $1', [id])
    assert.equal(rows[0].expires_at, null, 'le lien reste permanent')
  })

  it('limite à 20 liens permanents par créateur', async () => {
    for (let i = 0; i < 20; i++) {
      await post('/api/share', { x: 0, y: 0, w: 8, h: 8, created_by: 'Alice' })
    }
    const res = await post('/api/share', { x: 0, y: 0, w: 8, h: 8, created_by: 'Alice' })
    assert.equal(res.statusCode, 429)
  })
})

describe('GET /api/share/:id', { skip: skip() }, () => {
  it('renvoie la zone partagée et son contenu actuel', async () => {
    await setPixel(redis, { x: 3, y: 3, colorId: 11, username: 'Alice', source: 'web' })
    const { id } = (await post('/api/share', { x: 3, y: 3, w: 2, h: 2 })).json()

    const body = (await get(`/api/share/${id}`)).json()
    assert.equal(body.grid[0], 11, 'le lien reflète l\'état courant du canvas')
  })

  it('renvoie 404 pour un lien inconnu', async () => {
    assert.equal((await get('/api/share/inconnu1')).statusCode, 404)
  })

  it('renvoie 410 pour un lien expiré', async () => {
    const { id } = (await post('/api/share', { x: 0, y: 0, w: 8, h: 8 })).json()
    await db.pool.query(`UPDATE shared_zones SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [id])
    assert.equal((await get(`/api/share/${id}`)).statusCode, 410)
  })
})
