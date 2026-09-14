// Tests du timelapse : fonctionnalités de l'arbre vérifiées par le serveur, et
// suppression des routes JSON qui renvoyaient l'historique sans limite.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp, TEST_JWT_SECRET } from './helpers/app.js'
import { FakeRedis } from './helpers/redis-fake.js'
import { timelapseRoutes, periodClause } from '../src/features/timelapse/routes.js'
import { playerDashboardRoutes } from '../src/features/dashboard/player.js'
import { analyticsRoutes } from '../src/features/analytics/routes.js'
import { TREE } from '../src/features/unlocks/tree.js'
import { checkFeatureUnlocks, unlockBaseNodes } from '../src/features/unlocks/engine.js'
import { _resetAttempts } from '../src/features/auth/rate-limit.js'

let db, app
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false
const auth = (username, role = 'user') => ({ authorization: `Bearer ${jwt.sign({ username, role }, TEST_JWT_SECRET)}` })
const get  = (url, headers = {}) => app.inject({ method: 'GET', url, headers })

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  app = await buildTestApp([timelapseRoutes, playerDashboardRoutes, analyticsRoutes], { pool: db.pool, redis: new FakeRedis(), gridSize: 2048 })
})
after(async () => { await app?.close(); await db?.cleanup() })
beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
  _resetAttempts()
})

async function createUser(username, { role = 'user', unlocks = [] } = {}) {
  await db.pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, 'h', role])
  for (const node of unlocks) await db.pool.query('INSERT INTO user_unlocks (username, node_id) VALUES ($1, $2)', [username, node])
}
const pose = (username, { x = 1, y = 1, color = 5, ago = '0 seconds', source = 'web' } = {}) => db.pool.query(
  `INSERT INTO pixel_history (x, y, color_id, username, source, placed_at) VALUES ($1, $2, $3, $4, $5, NOW() - $6::interval)`,
  [x, y, color, username, source, ago]
)
const frameCount = (buf) => {
  let count = 0
  for (let i = 0; i < buf.length - 9; i++) if (buf[i] === 0x2C && buf[i + 9] === 0) count++   // approximation suffisante pour 1 à 3 images
  return count
}

describe('nœuds du timelapse', () => {
  it('sont livrés, sans dépendre de la sélection de zone', () => {
    assert.equal(TREE['feature:timelapse_personal'].comingSoon, undefined)
    assert.equal(TREE['feature:timelapse_global'].comingSoon, undefined)
    assert.deepEqual(TREE['feature:timelapse_personal'].conditions, [
      { type: 'days_played', min: 2 }, { type: 'pixels_lost', min: 1 },
    ])
    assert.deepEqual(TREE['feature:timelapse_global'].conditions, [
      { type: 'feature_unlocked', nodeId: 'feature:timelapse_personal' }, { type: 'zones_visited', min: 5 },
    ])
  })

  it('periodClause n\'accepte que la liste blanche', () => {
    assert.equal(periodClause('24h'), `placed_at > NOW() - INTERVAL '24 hours'`)
    assert.equal(periodClause("1 hour'; DROP TABLE users; --"), 'TRUE')
    assert.equal(periodClause(undefined), 'TRUE')
  })
})

describe('déblocage en jouant', { skip: skip() }, () => {
  it('le timelapse personnel puis le global se débloquent dans l\'ordre', async () => {
    await createUser('Alice')
    await unlockBaseNodes(db.pool, 'Alice')
    await db.pool.query(`INSERT INTO user_stats (username, pixels_lost, days_played, zones_visited)
      VALUES ('Alice', 1, '["2026-09-13","2026-09-14"]', '["0:0","1:0","2:0","3:0","4:0"]')`)
    const first = (await checkFeatureUnlocks(db.pool, 'Alice')).map(u => u.nodeId)
    assert.ok(first.includes('feature:timelapse_personal'))
    assert.ok(first.includes('feature:timelapse_global'), 'le prérequis débloqué dans le même passage compte aussitôt')
  })
})

describe('GET /api/timelapse/gif — toute la toile', { skip: skip() }, () => {
  it('exige une connexion puis le nœud global', async () => {
    await createUser('Alice', { unlocks: ['feature:timelapse_personal'] })
    await pose('Alice')
    assert.equal((await get('/api/timelapse/gif')).statusCode, 401)
    const res = await get('/api/timelapse/gif', auth('Alice'))
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().nodeId, 'feature:timelapse_global')
  })

  it('s\'ouvre au joueur qui l\'a débloqué et à l\'équipe', async () => {
    await createUser('Alice', { unlocks: ['feature:timelapse_global'] })
    await createUser('Modo', { role: 'admin' })
    await pose('Alice')
    assert.equal((await get('/api/timelapse/gif', auth('Alice'))).statusCode, 200)
    assert.equal((await get('/api/timelapse/gif', auth('Modo', 'admin'))).statusCode, 200)
  })

  it('rejoue les effacements de modération : un contenu retiré ne revit pas', async () => {
    await createUser('Alice', { unlocks: ['feature:timelapse_global'] })
    await pose('Troll', { ago: '2 minutes' })
    await pose(null, { color: 0, source: 'moderation', ago: '1 minute' })
    const res = await get('/api/timelapse/gif', auth('Alice'))
    assert.equal(frameCount(res.rawPayload), 2, 'la pose et son effacement')
  })

  it('filtre par période', async () => {
    await createUser('Alice', { unlocks: ['feature:timelapse_global'] })
    await pose('Alice', { ago: '2 hours' })
    await pose('Alice')
    assert.equal(frameCount((await get('/api/timelapse/gif?since=1h', auth('Alice'))).rawPayload), 1)
    assert.equal(frameCount((await get('/api/timelapse/gif', auth('Alice'))).rawPayload), 2)
  })
})

describe('GET /api/players/:username/gif — timelapse personnel', { skip: skip() }, () => {
  it('exige le nœud personnel', async () => {
    await createUser('Alice')
    await pose('Alice')
    const res = await get('/api/players/Alice/gif', auth('Alice'))
    assert.equal(res.statusCode, 403)
    assert.equal(res.json().nodeId, 'feature:timelapse_personal')
  })

  it('donne son propre timelapse, quelle que soit la casse', async () => {
    await createUser('Alice', { unlocks: ['feature:timelapse_personal'] })
    await pose('Alice')
    assert.equal((await get('/api/players/alice/gif', auth('Alice'))).statusCode, 200)
  })

  it('refuse celui d\'un autre joueur', async () => {
    await createUser('Alice', { unlocks: ['feature:timelapse_personal'] })
    await createUser('Bob')
    await pose('Bob')
    const res = await get('/api/players/Bob/gif', auth('Alice'))
    assert.equal(res.statusCode, 403)
    assert.match(res.json().error, /propre timelapse/)
  })

  it('laisse l\'équipe consulter celui d\'un joueur', async () => {
    await createUser('Modo', { role: 'admin' })
    await createUser('Bob')
    await pose('Bob')
    assert.equal((await get('/api/players/Bob/gif', auth('Modo', 'admin'))).statusCode, 200)
  })

  it('filtre par période', async () => {
    await createUser('Alice', { unlocks: ['feature:timelapse_personal'] })
    await pose('Alice', { ago: '3 days' })
    await pose('Alice')
    assert.equal(frameCount((await get('/api/players/Alice/gif?since=24h', auth('Alice'))).rawPayload), 1)
  })
})

describe('routes JSON supprimées', { skip: skip() }, () => {
  for (const url of ['/api/timelapse', '/api/players/Alice/timelapse', '/api/history', '/api/snapshot?at=2026-01-01']) {
    it(`${url} n'existe plus`, async () => {
      assert.equal((await get(url, auth('Staff', 'superadmin'))).statusCode, 404)
    })
  }
})
