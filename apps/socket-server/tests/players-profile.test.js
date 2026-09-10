// Tests des surfaces publiques joueur : classement, feed, profil.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp } from './helpers/app.js'
import { playerRoutes } from '../src/features/players/routes.js'
import { profileRoutes } from '../src/features/profile/routes.js'

let db, app
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  app = await buildTestApp([playerRoutes, profileRoutes], { pool: db.pool })
})

after(async () => {
  await app?.close()
  await db?.cleanup()
})

beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
})

const get = (url) => app.inject({ method: 'GET', url })

async function seedPixels() {
  await db.pool.query(`
    INSERT INTO pixel_history (x,y,color_id,username,source) VALUES
    (1,1,5,'Alice','web'), (2,2,5,'Alice','web'), (3,3,7,'Alice','web'),
    (4,4,3,'Bob','minecraft'),
    (5,5,1,NULL,'web')
  `)
}

describe('GET /api/leaderboard', { skip: skip() }, () => {
  it('classe les joueurs par nombre de pixels posés', async () => {
    await seedPixels()
    const board = (await get('/api/leaderboard')).json().leaderboard

    assert.equal(board[0].username,      'Alice')
    assert.equal(board[0].pixels_placed, 3)
    assert.equal(board[0].rank,          1)
    assert.equal(board[1].username,      'Bob')
    assert.equal(board[1].rank,          2)
  })

  it('exclut les poses anonymes du classement', async () => {
    await seedPixels()
    const board = (await get('/api/leaderboard')).json().leaderboard
    assert.ok(board.every(p => p.username !== null), 'aucune ligne sans pseudo')
    assert.equal(board.length, 2)
  })

  it('compte les couleurs distinctes et la couleur favorite', async () => {
    await seedPixels()
    const alice = (await get('/api/leaderboard')).json().leaderboard[0]
    assert.equal(alice.colors_used,    2)
    assert.equal(alice.favorite_color, 5, 'la couleur la plus posée')
  })

  it('respecte le paramètre limit et tolère une valeur invalide', async () => {
    await seedPixels()
    assert.equal((await get('/api/leaderboard?limit=1')).json().leaderboard.length, 1)
    assert.equal((await get('/api/leaderboard?limit=abc')).statusCode, 200)
  })

  it('renvoie un classement vide sans données', async () => {
    assert.deepEqual((await get('/api/leaderboard')).json().leaderboard, [])
  })
})

describe('GET /api/leaderboard/recent', { skip: skip() }, () => {
  it('renvoie les dernières poses, de la plus récente à la plus ancienne', async () => {
    await db.pool.query(`
      INSERT INTO pixel_history (x,y,color_id,username,source,placed_at) VALUES
      (1,1,5,'Alice','web',       NOW() - INTERVAL '2 hours'),
      (2,2,7,'Bob',  'minecraft', NOW() - INTERVAL '1 hour')
    `)
    const recent = (await get('/api/leaderboard/recent')).json().recent
    assert.equal(recent[0].username, 'Bob', 'le plus récent en tête')
    assert.equal(recent.length, 2)
  })
})

describe('GET /api/profile/:username', { skip: skip() }, () => {
  beforeEach(async () => {
    if (db.skipped) return
    await db.pool.query(
      'INSERT INTO users (username, password_hash, streak_hours) VALUES ($1, $2, $3)',
      ['Alice', 'hash', 5]
    )
    await db.pool.query(
      'INSERT INTO user_stats (username, pixels_placed, pixels_lost) VALUES ($1, $2, $3)',
      ['Alice', 42, 7]
    )
  })

  it('renvoie le profil public du joueur', async () => {
    const res = await get('/api/profile/Alice')
    assert.equal(res.statusCode, 200)

    const body = res.json()
    assert.equal(body.username ?? body.user?.username, 'Alice')
  })

  it('trouve le joueur quelle que soit la casse demandée', async () => {
    assert.equal((await get('/api/profile/ALICE')).statusCode, 200)
    assert.equal((await get('/api/profile/alice')).statusCode, 200)
  })

  it('renvoie 404 pour un joueur inconnu', async () => {
    assert.equal((await get('/api/profile/Fantome')).statusCode, 404)
  })

  it('ne divulgue jamais le hash du mot de passe', async () => {
    const body = JSON.stringify((await get('/api/profile/Alice')).json())
    assert.ok(!body.includes('password'), 'aucun champ lié au mot de passe ne doit sortir')
    assert.ok(!body.includes('hash'))
  })
})
