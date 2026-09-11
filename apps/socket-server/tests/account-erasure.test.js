// Tests du droit à l'effacement.
//
// Régression couverte : DELETE /api/auth/account répondait 200, mais les pixels
// gardaient le pseudo de leur auteur, en base comme dans Redis. Le compte
// supprimé restait premier du classement public, avec un profil complet sur
// /api/players/:username. Et son JWT, valide sept jours, lui permettait de
// continuer à poser des pixels sous ce même pseudo.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp, BROWSER_HEADERS, authHeaders } from './helpers/app.js'
import { FakeRedis } from './helpers/redis-fake.js'
import { authRoutes } from '../src/features/auth/routes.js'
import { playerRoutes } from '../src/features/players/routes.js'
import { placePixel } from '../src/features/canvas/place-pixel.js'
import { createCooldownController } from '../src/features/canvas/cooldown.js'
import { loadGrid, setPixel, getPixelMeta, anonymizePixelOwner, getPixelIndex } from '../src/features/canvas/grid.js'
import { _resetAttempts } from '../src/features/auth/rate-limit.js'

let db, app, redis, deleted
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  redis = new FakeRedis()
  app = await buildTestApp([authRoutes, playerRoutes], {
    pool: db.pool, redis,
    onAccountDeleted: (username) => deleted.push(username),
  })
})
after(async () => { await app?.close(); await db?.cleanup() })

beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
  await redis.flushall()
  await loadGrid(redis)
  deleted = []
  _resetAttempts()
})

/** Crée un compte, lui fait poser deux pixels, puis le supprime. */
async function createActiveThenDelete(username = 'Effacee') {
  const { token } = (await app.inject({
    method: 'POST', url: '/api/auth/register', headers: BROWSER_HEADERS,
    payload: { username, password: 'motdepasse' },
  })).json()

  await db.pool.query(
    `INSERT INTO pixel_history (x, y, color_id, username, source) VALUES (1, 1, 5, $1, 'web'), (2, 2, 7, $1, 'web')`,
    [username]
  )
  await setPixel(redis, { x: 1, y: 1, colorId: 5, username, source: 'web' })
  await setPixel(redis, { x: 2, y: 2, colorId: 7, username, source: 'web' })
  await setPixel(redis, { x: 3, y: 3, colorId: 9, username: 'Autre', source: 'web' })

  const res = await app.inject({
    method: 'DELETE', url: '/api/auth/account',
    headers: authHeaders(token), payload: { password: 'motdepasse' },
  })
  assert.equal(res.statusCode, 200)
  return token
}

describe('effacement — surfaces publiques', { skip: skip() }, () => {
  it('le compte supprimé disparaît du classement', async () => {
    await createActiveThenDelete()
    const board = (await app.inject({ method: 'GET', url: '/api/leaderboard' })).json().leaderboard
    assert.ok(!board.some(p => p.username === 'Effacee'), 'le pseudo ne doit plus figurer au classement')
  })

  it('le profil joueur ne renvoie plus d\'activité', async () => {
    await createActiveThenDelete()
    const body = (await app.inject({ method: 'GET', url: '/api/players/Effacee' })).json()
    assert.ok(!body.pixels_placed, `aucune activité ne doit être rattachée : ${JSON.stringify(body)}`)
  })
})

describe('effacement — données', { skip: skip() }, () => {
  it('garde les pixels en base, mais sans auteur', async () => {
    await createActiveThenDelete()
    const { rows } = await db.pool.query('SELECT username FROM pixel_history ORDER BY x')
    assert.equal(rows.length, 2, 'le canvas et son historique restent intacts')
    assert.ok(rows.every(r => r.username === null))
  })

  it('retire le pseudo des métadonnées Redis, sans toucher aux couleurs ni aux autres joueurs', async () => {
    await createActiveThenDelete()
    assert.equal((await getPixelMeta(redis, 1, 1)).username, null)
    assert.equal((await getPixelMeta(redis, 2, 2)).username, null)
    assert.equal((await getPixelMeta(redis, 3, 3)).username, 'Autre', 'les autres joueurs sont préservés')

    const grid = await loadGrid(redis)
    assert.equal(grid[getPixelIndex(1, 1)], 5, 'la couleur du pixel reste en place')
  })

  it('détache les zones partagées créées par le compte', async () => {
    const { token } = (await app.inject({
      method: 'POST', url: '/api/auth/register', headers: BROWSER_HEADERS,
      payload: { username: 'Partageuse', password: 'motdepasse' },
    })).json()
    await db.pool.query(`INSERT INTO shared_zones (id, x, y, w, h, created_by) VALUES ('abcd1234', 0, 0, 8, 8, 'Partageuse')`)
    await app.inject({ method: 'DELETE', url: '/api/auth/account', headers: authHeaders(token), payload: { password: 'motdepasse' } })

    const { rows } = await db.pool.query('SELECT created_by FROM shared_zones')
    assert.equal(rows[0].created_by, null)
  })

  it('prévient le temps réel pour révoquer la session', async () => {
    await createActiveThenDelete()
    assert.deepEqual(deleted, ['Effacee'])
  })
})

describe('effacement — jeton encore valide', { skip: skip() }, () => {
  it('un compte supprimé ne peut plus poser de pixel avec son ancien JWT', async () => {
    await createActiveThenDelete()
    const cooldown = createCooldownController({ pool: db.pool })
    const res = await placePixel(
      { redis, pool: db.pool, cooldown },
      { x: 50, y: 50, colorId: 3, username: 'Effacee', source: 'web' },
      { verifiedUsername: 'Effacee' },
    )
    assert.equal(res.ok, false)
    assert.match(res.error, /n'existe plus/)
    cooldown.stop()
  })
})

describe('anonymizePixelOwner', () => {
  it('parcourt le hash sur plusieurs pages et ignore la casse', async () => {
    const r = new FakeRedis()
    // Plus d'entrées que la taille de page, pour exercer le curseur
    for (let i = 0; i < 12_000; i++) {
      await setPixel(r, { x: i % 2048, y: Math.floor(i / 2048), colorId: 1, username: i % 3 === 0 ? 'CIBLE' : 'autre', source: 'web' })
    }
    const changed = await anonymizePixelOwner(r, 'cible')
    assert.equal(changed, 4000)
    assert.equal((await getPixelMeta(r, 0, 0)).username, null)
    assert.equal((await getPixelMeta(r, 1, 0)).username, 'autre')
  })

  it('est idempotente', async () => {
    const r = new FakeRedis()
    await setPixel(r, { x: 1, y: 1, colorId: 1, username: 'X', source: 'web' })
    assert.equal(await anonymizePixelOwner(r, 'X'), 1)
    assert.equal(await anonymizePixelOwner(r, 'X'), 0)
  })

  it('ignore les métadonnées corrompues', async () => {
    const r = new FakeRedis()
    await r.hset('voxelplace:pixels', 'cassé', 'pas du JSON')
    await assert.doesNotReject(() => anonymizePixelOwner(r, 'X'))
  })
})
