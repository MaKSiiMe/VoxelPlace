// Tests d'intégration des routes d'authentification, contre un vrai PostgreSQL.
//
// Régression couverte : la production a passé trois mois avec un front qui
// n'envoyait pas l'en-tête X-Requested-With face à un back qui l'exigeait —
// inscription et connexion impossibles. Aucun test ne traversait la route
// complète, donc rien ne l'a signalé.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp, BROWSER_HEADERS, authHeaders, TEST_JWT_SECRET } from './helpers/app.js'
import { authRoutes, verifyToken } from '../src/features/auth/routes.js'
import { _resetAttempts } from '../src/features/auth/rate-limit.js'

let db, app
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  app = await buildTestApp([authRoutes], { pool: db.pool })
})

after(async () => {
  await app?.close()
  await db?.cleanup()
})

beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
  _resetAttempts()
})

const register = (body, headers = BROWSER_HEADERS) =>
  app.inject({ method: 'POST', url: '/api/auth/register', headers, payload: body })

const login = (body, headers = BROWSER_HEADERS) =>
  app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: body })

describe('POST /api/auth/register', { skip: skip() }, () => {
  it('crée un compte et renvoie un JWT exploitable', async () => {
    const res = await register({ username: 'Alice', password: 'motdepasse' })
    assert.equal(res.statusCode, 201)

    const body = res.json()
    assert.equal(body.username, 'Alice')
    assert.equal(body.role,     'user')

    const payload = verifyToken(body.token, TEST_JWT_SECRET)
    assert.equal(payload.username, 'Alice')
  })

  it('stocke un hash bcrypt, jamais le mot de passe en clair', async () => {
    await register({ username: 'Alice', password: 'motdepasse' })
    const { rows } = await db.pool.query('SELECT password_hash FROM users WHERE username = $1', ['Alice'])
    assert.ok(rows[0].password_hash.startsWith('$2'), 'doit être un hash bcrypt')
    assert.ok(!rows[0].password_hash.includes('motdepasse'))
  })

  it('refuse la requête sans en-tête X-Requested-With (protection CSRF)', async () => {
    const res = await register({ username: 'Alice', password: 'motdepasse' }, { 'content-type': 'application/json' })
    assert.equal(res.statusCode, 403)
    assert.match(res.json().error, /CSRF/)
  })

  it('refuse un pseudo déjà pris, quelle que soit la casse', async () => {
    await register({ username: 'Alice', password: 'motdepasse' })
    const res = await register({ username: 'Alice', password: 'autrepass' })
    assert.equal(res.statusCode, 409)
  })

  it('refuse un pseudo trop court et un mot de passe trop court', async () => {
    assert.equal((await register({ username: 'A',     password: 'motdepasse' })).statusCode, 400)
    assert.equal((await register({ username: 'Alice', password: '123'        })).statusCode, 400)
  })

  it('refuse une requête sans identifiants', async () => {
    assert.equal((await register({})).statusCode, 400)
  })

  it('attribue le rôle superuser aux préfixes réservés', async () => {
    const res = await register({ username: 'hbtn_maxime', password: 'motdepasse' })
    assert.equal(res.json().role, 'superuser')
  })

  it('bloque au-delà de 10 tentatives par minute', async () => {
    for (let i = 0; i < 10; i++) await register({ username: `User${i}`, password: 'motdepasse' })
    const res = await register({ username: 'Onzieme', password: 'motdepasse' })
    assert.equal(res.statusCode, 429)
  })
})

describe('POST /api/auth/login', { skip: skip() }, () => {
  beforeEach(async () => {
    if (db.skipped) return
    await register({ username: 'Alice', password: 'motdepasse' })
    _resetAttempts()
  })

  it('connecte avec les bons identifiants', async () => {
    const res = await login({ username: 'Alice', password: 'motdepasse' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().username, 'Alice')
  })

  it('accepte le pseudo sans tenir compte de la casse', async () => {
    assert.equal((await login({ username: 'ALICE', password: 'motdepasse' })).statusCode, 200)
  })

  it('refuse un mot de passe incorrect', async () => {
    const res = await login({ username: 'Alice', password: 'mauvais' })
    assert.equal(res.statusCode, 401)
  })

  it('renvoie le même message pour un compte inexistant que pour un mauvais mot de passe', async () => {
    const inconnu = await login({ username: 'Personne', password: 'motdepasse' })
    const mauvais = await login({ username: 'Alice',    password: 'mauvais'    })
    assert.equal(inconnu.statusCode, 401)
    assert.equal(inconnu.json().error, mauvais.json().error, 'ne doit pas révéler quels comptes existent')
  })

  it('refuse la requête sans en-tête CSRF', async () => {
    const res = await login({ username: 'Alice', password: 'motdepasse' }, { 'content-type': 'application/json' })
    assert.equal(res.statusCode, 403)
  })
})

describe('DELETE /api/auth/account', { skip: skip() }, () => {
  let token
  beforeEach(async () => {
    if (db.skipped) return
    token = (await register({ username: 'Alice', password: 'motdepasse' })).json().token
  })

  it('supprime le compte et ses données personnelles', async () => {
    await db.pool.query('INSERT INTO user_unlocks (username, node_id) VALUES ($1, $2)', ['Alice', 'color_red'])
    await db.pool.query('INSERT INTO user_stats (username, pixels_placed) VALUES ($1, $2)', ['Alice', 5])

    const res = await app.inject({
      method: 'DELETE', url: '/api/auth/account',
      headers: authHeaders(token), payload: { password: 'motdepasse' },
    })
    assert.equal(res.statusCode, 200)

    for (const table of ['users', 'user_unlocks', 'user_stats']) {
      const { rows } = await db.pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE LOWER(username) = 'alice'`)
      assert.equal(rows[0].n, 0, `${table} doit être vidée pour ce compte`)
    }
  })

  it("conserve l'historique des pixels (donnée de jeu, dissociée du compte)", async () => {
    await db.pool.query('INSERT INTO pixel_history (x,y,color_id,username,source) VALUES (1,1,5,$1,$2)', ['Alice', 'web'])
    await app.inject({
      method: 'DELETE', url: '/api/auth/account',
      headers: authHeaders(token), payload: { password: 'motdepasse' },
    })
    const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM pixel_history')
    assert.equal(rows[0].n, 1)
  })

  it('exige le mot de passe et refuse un mot de passe incorrect', async () => {
    const sans = await app.inject({ method: 'DELETE', url: '/api/auth/account', headers: authHeaders(token), payload: {} })
    assert.equal(sans.statusCode, 400)

    const faux = await app.inject({
      method: 'DELETE', url: '/api/auth/account',
      headers: authHeaders(token), payload: { password: 'mauvais' },
    })
    assert.equal(faux.statusCode, 401)

    const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM users')
    assert.equal(rows[0].n, 1, 'le compte doit survivre à une tentative refusée')
  })

  it('refuse sans token, et avec un token signé par un autre secret', async () => {
    const sansToken = await app.inject({ method: 'DELETE', url: '/api/auth/account', headers: BROWSER_HEADERS, payload: { password: 'motdepasse' } })
    assert.equal(sansToken.statusCode, 401)

    const bidon = await app.inject({
      method: 'DELETE', url: '/api/auth/account',
      headers: authHeaders('eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.mauvaise_signature'),
      payload: { password: 'motdepasse' },
    })
    assert.equal(bidon.statusCode, 401)
  })
})
