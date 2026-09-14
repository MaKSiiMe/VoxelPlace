// Tests d'intégration des routes de progression : l'arbre tel que le client le
// reçoit, et le déblocage d'une couleur, qui doit la rendre posable aussitôt.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp, TEST_JWT_SECRET } from './helpers/app.js'
import { unlockRoutes } from '../src/features/unlocks/routes.js'
import { unlockBaseNodes } from '../src/features/unlocks/engine.js'
import { createColorAccess } from '../src/features/unlocks/color-access.js'

let db, app, colorAccess
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

const auth = (username) => ({ authorization: `Bearer ${jwt.sign({ username, role: 'user' }, TEST_JWT_SECRET)}` })

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  colorAccess = createColorAccess({ pool: db.pool })
  app = await buildTestApp([unlockRoutes], { pool: db.pool, colorAccess })
})
after(async () => {
  colorAccess?.stop()
  await app?.close()
  await db?.cleanup()
})

beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
  colorAccess.invalidate('Alice')
})

async function createAlice(streak = 0) {
  await db.pool.query('INSERT INTO users (username, password_hash, streak_hours) VALUES ($1, $2, $3)', ['Alice', 'hash', streak])
  await unlockBaseNodes(db.pool, 'Alice')
}

const getTree = (headers = {}) => app.inject({ method: 'GET', url: '/api/unlocks/tree', headers })

describe('GET /api/unlocks/tree', { skip: skip() }, () => {
  it('montre à un visiteur la palette d\'un compte neuf, sans progression', async () => {
    const res = await getTree()
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.deepEqual(body.colors, [0, 3, 5, 7, 12])
    assert.equal(body.streak_hours, null)
    const orange = body.tree.find(n => n.nodeId === 'color:6')
    assert.equal(orange.unlocked, false)
    assert.equal(orange.conditions[0].current, undefined)
  })

  it('marque les fonctionnalités à venir et ne liste plus celles retirées', async () => {
    const { tree } = (await getTree()).json()
    assert.equal(tree.find(n => n.nodeId === 'feature:search').comingSoon, true)
    assert.equal(tree.find(n => n.nodeId === 'feature:heatmap').comingSoon, false, 'livrée')
    assert.equal(tree.find(n => n.nodeId === 'color:6').comingSoon, false)
    assert.equal(tree.find(n => n.nodeId === 'feature:leaderboard'), undefined)
  })

  it('donne au joueur connecté sa progression condition par condition', async () => {
    await createAlice(4)
    await db.pool.query(`INSERT INTO user_color_counts (username, color_id, count) VALUES ('Alice', 5, 12), ('Alice', 7, 3)`)

    const body = (await getTree(auth('Alice'))).json()
    assert.equal(body.streak_hours, 4)
    const orange = body.tree.find(n => n.nodeId === 'color:6')
    assert.deepEqual(orange.conditions, [
      { type: 'color_count', colorId: 5, min: 10, met: true,  current: 12, target: 10 },
      { type: 'color_count', colorId: 7, min: 10, met: false, current: 3,  target: 10 },
    ])
    assert.equal(body.tree.find(n => n.nodeId === 'color:5').unlocked, true)
  })
})

describe('POST /api/unlocks/:nodeId', { skip: skip() }, () => {
  it('rend une couleur posable dès son déblocage, sans attendre l\'expiration du cache', async () => {
    await createAlice(5)
    await db.pool.query(`INSERT INTO user_color_counts (username, color_id, count) VALUES ('Alice', 5, 10), ('Alice', 7, 10)`)
    assert.equal(await colorAccess.canUse('Alice', 6), false)   // met la valeur en cache

    const res = await app.inject({ method: 'POST', url: '/api/unlocks/color:6', headers: auth('Alice') })
    assert.equal(res.statusCode, 201)
    assert.equal(await colorAccess.canUse('Alice', 6), true)

    const me = (await app.inject({ method: 'GET', url: '/api/unlocks', headers: auth('Alice') })).json()
    assert.deepEqual(me.colors, [0, 3, 5, 6, 7, 12])
    assert.equal(me.streak_hours, 3)
  })

  it('refuse une fonctionnalité à venir', async () => {
    await createAlice(50)
    const res = await app.inject({ method: 'POST', url: '/api/unlocks/feature:zone_share', headers: auth('Alice') })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().error, 'Bientôt disponible')
    const { rows } = await db.pool.query(`SELECT streak_hours FROM users WHERE username = 'Alice'`)
    assert.equal(rows[0].streak_hours, 50, 'aucun streak dépensé')
  })

  it('exige une connexion', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/unlocks/color:6' })
    assert.equal(res.statusCode, 401)
  })
})
