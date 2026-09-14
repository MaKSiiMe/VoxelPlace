// Tests de la heatmap : fonctionnalité débloquable, vérifiée par le serveur,
// et réponse de taille fixe quel que soit l'historique.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp, TEST_JWT_SECRET } from './helpers/app.js'
import { FakeRedis } from './helpers/redis-fake.js'
import { analyticsRoutes } from '../src/features/analytics/routes.js'
import { binHeatmap, encodeCounts, HEATMAP_SIZE, HEATMAP_CELL } from '../src/features/analytics/heatmap.js'
import { TREE } from '../src/features/unlocks/tree.js'
import { checkFeatureUnlocks, unlockBaseNodes } from '../src/features/unlocks/engine.js'

const decode = (b64) => {
  const buf = Buffer.from(b64, 'base64')
  return Array.from({ length: buf.length / 2 }, (_, i) => buf.readUInt16LE(i * 2))
}

describe('binHeatmap', () => {
  it('range chaque case à sa place et calcule max et total', () => {
    const { counts, max, total } = binHeatmap([{ bx: 0, by: 0, count: 3 }, { bx: 255, by: 1, count: 9 }])
    assert.equal(counts.length, HEATMAP_SIZE * HEATMAP_SIZE)
    assert.equal(counts[0], 3)
    assert.equal(counts[1 * HEATMAP_SIZE + 255], 9)
    assert.equal(max, 9)
    assert.equal(total, 12)
  })

  it('borne un compteur à 65 535 sans fausser le total, et ignore une case hors grille', () => {
    const { counts, max, total } = binHeatmap([{ bx: 2, by: 2, count: 70000 }, { bx: 256, by: 0, count: 5 }])
    assert.equal(counts[2 * HEATMAP_SIZE + 2], 65535)
    assert.equal(max, 65535)
    assert.equal(total, 70000)
  })

  it('encode en petit-boutiste', () => {
    assert.deepEqual(decode(encodeCounts(Uint16Array.from([1, 258]))), [1, 258])
  })
})

describe('nœud feature:heatmap', () => {
  it('est livré, et atteignable : 10 pixels perdus', () => {
    assert.equal(TREE['feature:heatmap'].comingSoon, undefined)
    assert.deepEqual(TREE['feature:heatmap'].conditions, [{ type: 'pixels_lost', min: 10 }])
  })
})

let db, app, clock
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false
const auth = (username) => ({ authorization: `Bearer ${jwt.sign({ username, role: 'user' }, TEST_JWT_SECRET)}` })

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  let t = 1_000_000
  clock = () => t
  clock.advance = (ms) => { t += ms }
  app = await buildTestApp([analyticsRoutes], { pool: db.pool, redis: new FakeRedis(), now: clock })
})
after(async () => { await app?.close(); await db?.cleanup() })
beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
  clock.advance(60_000)   // hors de la fenêtre de cache du test précédent
})

async function createUser(username, { role = 'user', heatmap = false } = {}) {
  await db.pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, 'h', role])
  if (heatmap) await db.pool.query(`INSERT INTO user_unlocks (username, node_id) VALUES ($1, 'feature:heatmap')`, [username])
}
const get = (url, headers = {}) => app.inject({ method: 'GET', url, headers })

describe('GET /api/heatmap — accès', { skip: skip() }, () => {
  it('exige une connexion', async () => {
    assert.equal((await get('/api/heatmap')).statusCode, 401)
  })

  it('refuse un joueur qui ne l\'a pas débloquée', async () => {
    await createUser('Alice')
    const res = await get('/api/heatmap', auth('Alice'))
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().nodeId, 'feature:heatmap')
  })

  it('ouvre la heatmap à un joueur qui l\'a débloquée', async () => {
    await createUser('Alice', { heatmap: true })
    assert.equal((await get('/api/heatmap', auth('Alice'))).statusCode, 200)
  })

  for (const role of ['superuser', 'admin', 'superadmin']) {
    it(`l'ouvre d'office au rôle ${role}`, async () => {
      await createUser('Staff', { role })
      assert.equal((await get('/api/heatmap', auth('Staff'))).statusCode, 200)
    })
  }

  it('refuse un compte supprimé dont le jeton est encore valide', async () => {
    assert.equal((await get('/api/heatmap', auth('Fantome'))).statusCode, 403)
  })

  it('rejette une période inconnue avant toute requête', async () => {
    assert.equal((await get('/api/heatmap?since=1an')).statusCode, 400)
  })
})

describe('GET /api/heatmap — contenu', { skip: skip() }, () => {
  beforeEach(async () => { if (!db.skipped) await createUser('Alice', { heatmap: true }) })

  it('regroupe les poses par case de 8 pixels, sans compter la modération', async () => {
    await db.pool.query(`INSERT INTO pixel_history (x, y, color_id, username, source) VALUES
      (0, 0, 1, 'a', 'web'), (7, 7, 1, 'b', 'minecraft'), (8, 0, 1, 'a', 'web'), (2047, 2047, 1, 'a', 'web'),
      (1, 1, 0, NULL, 'moderation')`)
    const body = (await get('/api/heatmap', auth('Alice'))).json()
    assert.equal(body.cell, HEATMAP_CELL)
    const counts = decode(body.counts)
    assert.equal(counts[0], 2, 'deux poses dans la case (0, 0), l\'effacement de modération exclu')
    assert.equal(counts[1], 1)
    assert.equal(counts[HEATMAP_SIZE * HEATMAP_SIZE - 1], 1)
    assert.equal(body.max, 2)
    assert.equal(body.total, 4)
  })

  it('garde une taille fixe quel que soit l\'historique', async () => {
    const empty = (await get('/api/heatmap', auth('Alice'))).rawPayload.length
    await db.pool.query(`INSERT INTO pixel_history (x, y, color_id, username, source)
      SELECT (g * 7) % 2048, (g * 13) % 2048, 1, 'a', 'web' FROM generate_series(1, 20000) g`)
    clock.advance(60_000)
    const full = (await get('/api/heatmap', auth('Alice'))).rawPayload.length
    assert.ok(full < 200_000, `${full} octets`)
    assert.ok(Math.abs(full - empty) < 100, 'seuls max et total changent de longueur')
  })

  it('filtre par période', async () => {
    await db.pool.query(`INSERT INTO pixel_history (x, y, color_id, username, source, placed_at) VALUES
      (0, 0, 1, 'a', 'web', NOW() - INTERVAL '2 hours'), (0, 0, 1, 'a', 'web', NOW())`)
    assert.equal((await get('/api/heatmap?since=1h', auth('Alice'))).json().total, 1)
    assert.equal((await get('/api/heatmap', auth('Alice'))).json().total, 2)
  })

  it('partage le calcul pendant 30 secondes', async () => {
    await db.pool.query(`INSERT INTO pixel_history (x, y, color_id, username, source) VALUES (0, 0, 1, 'a', 'web')`)
    assert.equal((await get('/api/heatmap', auth('Alice'))).json().total, 1)
    await db.pool.query(`INSERT INTO pixel_history (x, y, color_id, username, source) VALUES (0, 0, 1, 'a', 'web')`)
    assert.equal((await get('/api/heatmap', auth('Alice'))).json().total, 1, 'servi depuis le cache')
    clock.advance(30_000)
    assert.equal((await get('/api/heatmap', auth('Alice'))).json().total, 2, 'recalculé à l\'expiration')
  })

  it('ne sert pas le cache à un joueur non autorisé', async () => {
    await get('/api/heatmap', auth('Alice'))
    await createUser('Bob')
    assert.equal((await get('/api/heatmap', auth('Bob'))).statusCode, 403)
  })
})

describe('déblocage de la heatmap en jouant', { skip: skip() }, () => {
  it('se débloque et s\'annonce dès 10 pixels perdus', async () => {
    await createUser('Alice')
    await unlockBaseNodes(db.pool, 'Alice')
    await db.pool.query(`INSERT INTO user_stats (username, pixels_lost) VALUES ('Alice', 10)`)
    const unlocks = await checkFeatureUnlocks(db.pool, 'Alice')
    assert.ok(unlocks.some(u => u.nodeId === 'feature:heatmap'))
    assert.equal((await get('/api/heatmap', auth('Alice'))).statusCode, 200)
  })
})
