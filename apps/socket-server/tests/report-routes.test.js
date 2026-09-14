// Tests de la feature signalement.
//
// Régression majeure couverte : requireAdmin y décodait le payload du jeton en
// base64 sans vérifier la signature, et lisait un champ `isAdmin` que personne
// n'émet. Un jeton forgé à la main ouvrait la file de modération ; les vrais
// administrateurs, eux, se voyaient refuser l'accès.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp, BROWSER_HEADERS, TEST_JWT_SECRET } from './helpers/app.js'
import { reportRoutes, validateReport } from '../src/features/report/routes.js'
import { _resetAttempts } from '../src/features/auth/rate-limit.js'

let db, app
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

const bearer = (token) => ({ ...BROWSER_HEADERS, authorization: `Bearer ${token}` })
const admin  = () => bearer(jwt.sign({ role: 'admin' },      TEST_JWT_SECRET, { expiresIn: '1h' }))
const player = (username) => bearer(jwt.sign({ username, role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' }))

/** Jeton non signé, forgé à la main — ce qu'un attaquant enverrait. */
function forgedToken(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.signature_bidon`
}

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  app = await buildTestApp([reportRoutes], { pool: db.pool })
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

describe('validateReport', () => {
  it('accepte un signalement de pixel avec ses coordonnées', () => {
    const r = validateReport({ target_type: 'pixel', x: 10, y: 20, reason: 'contenu offensant' })
    assert.equal(r.target_type, 'pixel')
    assert.equal(r.x, 10)
  })

  it('accepte un signalement de joueur', () => {
    assert.equal(validateReport({ target_type: 'player', target_username: 'Tricheur' }).target_username, 'Tricheur')
  })

  it('refuse un type inconnu, un pixel sans coordonnées, un joueur sans pseudo', () => {
    assert.equal(validateReport({ target_type: 'autre' }), null)
    assert.equal(validateReport({ target_type: 'pixel' }), null)
    assert.equal(validateReport({ target_type: 'player' }), null)
    assert.equal(validateReport({}), null)
    assert.equal(validateReport(), null)
  })
})

describe('POST /api/report', { skip: skip() }, () => {
  const report = (payload, headers = BROWSER_HEADERS) =>
    app.inject({ method: 'POST', url: '/api/report', headers, payload })

  it('accepte un signalement anonyme', async () => {
    const res = await report({ target_type: 'pixel', x: 1, y: 2, reason: 'test' })
    assert.equal(res.statusCode, 201)

    const { rows } = await db.pool.query('SELECT reporter, target_type FROM reports')
    assert.equal(rows[0].reporter, null)
    assert.equal(rows[0].target_type, 'pixel')
  })

  it('attribue le signalement au joueur connecté', async () => {
    await report({ target_type: 'player', target_username: 'Tricheur' }, player('Alice'))
    const { rows } = await db.pool.query('SELECT reporter FROM reports')
    assert.equal(rows[0].reporter, 'Alice')
  })

  it('refuse un signalement invalide', async () => {
    assert.equal((await report({ target_type: 'autre' })).statusCode, 400)
  })

  it('refuse des coordonnées hors grille au lieu d\'échouer en 500', async () => {
    assert.equal((await report({ target_type: 'pixel', x: 99999, y: 1 })).statusCode, 400)
    assert.equal((await report({ target_type: 'pixel', x: 1.5,   y: 1 })).statusCode, 400)
  })

  it('tronque un motif plus long que la colonne au lieu d\'échouer en 500', async () => {
    const res = await report({ target_type: 'pixel', x: 1, y: 1, reason: 'x'.repeat(300) })
    assert.equal(res.statusCode, 201)
    const { rows } = await db.pool.query('SELECT length(reason)::int AS n FROM reports')
    assert.equal(rows[0].n, 256)
  })

  it('limite le nombre de signalements par minute', async () => {
    const codes = []
    for (let i = 0; i < 8; i++) codes.push((await report({ target_type: 'pixel', x: 1, y: 1 })).statusCode)
    assert.deepEqual(codes.slice(0, 5), [201, 201, 201, 201, 201])
    assert.equal(codes[5], 429, 'la file de modération ne doit pas pouvoir être inondée')
    const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM reports')
    assert.equal(rows[0].n, 5)
  })
})

describe('GET /api/admin/reports', { skip: skip() }, () => {
  beforeEach(async () => {
    if (db.skipped) return
    await db.pool.query(`
      INSERT INTO reports (target_type, target_username, reason, status) VALUES
      ('player', 'Tricheur', 'spam',   'pending'),
      ('player', 'Autre',    'triche', 'reviewed')
    `)
  })

  const list = (headers, query = '') =>
    app.inject({ method: 'GET', url: `/api/admin/reports${query}`, headers })

  it('refuse un jeton forgé sans signature valide', async () => {
    const res = await list(bearer(forgedToken({ isAdmin: true, role: 'superadmin' })))
    assert.equal(res.statusCode, 401, 'la signature du jeton doit être vérifiée')
  })

  it('refuse un jeton signé par un autre secret', async () => {
    const res = await list(bearer(jwt.sign({ role: 'admin' }, 'mauvais_secret')))
    assert.equal(res.statusCode, 401)
  })

  it('refuse un joueur ordinaire et une requête sans jeton', async () => {
    assert.equal((await list(player('Alice'))).statusCode, 403)
    assert.equal((await list(BROWSER_HEADERS)).statusCode, 401)
  })

  it('laisse passer un administrateur authentifié', async () => {
    const res = await list(admin())
    assert.equal(res.statusCode, 200, 'un vrai administrateur doit pouvoir consulter la file')
    assert.equal(res.json().reports.length, 1, 'les signalements en attente par défaut')
  })

  it('permet de lister tous les signalements', async () => {
    assert.equal((await list(admin(), '?status=all')).json().reports.length, 2)
  })

  it('tolère un limit invalide', async () => {
    assert.equal((await list(admin(), '?limit=abc')).statusCode, 200)
  })
})

describe('PATCH /api/admin/reports/:id', { skip: skip() }, () => {
  let reportId
  beforeEach(async () => {
    if (db.skipped) return
    const { rows } = await db.pool.query(
      `INSERT INTO reports (target_type, target_username, status)
       VALUES ('player', 'Tricheur', 'pending') RETURNING id`
    )
    reportId = rows[0].id
  })

  const review = (id, headers) =>
    app.inject({ method: 'PATCH', url: `/api/admin/reports/${id}`, headers, payload: { reviewed_by: 'Maxime' } })

  it('refuse un jeton forgé', async () => {
    assert.equal((await review(reportId, bearer(forgedToken({ isAdmin: true })))).statusCode, 401)
  })

  it('marque le signalement comme traité, au nom du jeton', async () => {
    const modo = bearer(jwt.sign({ role: 'admin', username: 'Modo' }, TEST_JWT_SECRET, { expiresIn: '1h' }))
    assert.equal((await review(reportId, modo)).statusCode, 200)
    const { rows } = await db.pool.query('SELECT status, reviewed_by FROM reports WHERE id = $1', [reportId])
    assert.equal(rows[0].status,      'reviewed')
    assert.equal(rows[0].reviewed_by, 'Modo', 'reviewed_by envoyé dans le corps est ignoré')
  })

  it('renvoie 404 pour un signalement déjà traité', async () => {
    await review(reportId, admin())
    assert.equal((await review(reportId, admin())).statusCode, 404)
  })

  it('rejette un identifiant non numérique', async () => {
    assert.equal((await review('abc', admin())).statusCode, 400)
  })
})
