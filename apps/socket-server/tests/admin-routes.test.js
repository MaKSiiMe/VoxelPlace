// Tests d'intégration de la surface d'administration.
//
// C'est la surface la plus dangereuse du projet : elle bannit, efface des
// pixels, vide le canvas entier et change les rôles. Elle n'avait aucun test.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp, BROWSER_HEADERS, TEST_JWT_SECRET } from './helpers/app.js'
import { FakeRedis } from './helpers/redis-fake.js'
import { adminRoutes } from '../src/features/admin/routes.js'
import { setPixel, loadGrid, getPixelIndex, GRID_SIZE } from '../src/features/canvas/grid.js'
import { _resetAttempts } from '../src/features/auth/rate-limit.js'

const ADMIN_PASSWORD = 'mot_de_passe_admin_test'

let db, app, redis, io, emitted, disconnected

const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

/** Faux serveur Socket.io : enregistre les émissions au lieu de les diffuser. */
function fakeIo() {
  emitted      = []
  disconnected = []
  const sockets = new Map()
  return {
    emit: (event, payload) => emitted.push({ event, payload, to: null }),
    to:   (id) => ({ emit: (event, payload) => emitted.push({ event, payload, to: id }) }),
    sockets: {
      sockets: {
        size: 0,
        get: (id) => ({ disconnect: () => disconnected.push(id) }),
      },
    },
    _sockets: sockets,
  }
}

const token = (role) => jwt.sign({ role }, TEST_JWT_SECRET, { expiresIn: '1h' })

// Volontairement sans content-type : plusieurs routes admin n'ont pas de corps,
// et annoncer application/json sans en envoyer fait répondre 400 à Fastify.
// Le front n'envoie pas non plus de content-type sur ces appels ; inject()
// ajoute celui qu'il faut dès qu'un payload est fourni.
const auth  = (role) => ({ authorization: `Bearer ${token(role)}` })

before(async () => {
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD
  db = await startTestDatabase()
  if (db.skipped) return
  redis = new FakeRedis()
  io    = fakeIo()
  app = await buildTestApp([adminRoutes], {
    pool: db.pool, redis, io,
    usernameToSocket: new Map(),
    setPixel, GRID_SIZE,
  })
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
  emitted      = []
  disconnected = []
  _resetAttempts()
})

describe('POST /api/admin/login', { skip: skip() }, () => {
  const login = (password) =>
    app.inject({ method: 'POST', url: '/api/admin/login', headers: BROWSER_HEADERS, payload: { password } })

  it('délivre un JWT superadmin avec le bon mot de passe', async () => {
    const res = await login(ADMIN_PASSWORD)
    assert.equal(res.statusCode, 200)
    assert.equal(jwt.verify(res.json().token, TEST_JWT_SECRET).role, 'superadmin')
  })

  it('refuse un mauvais mot de passe', async () => {
    assert.equal((await login('mauvais')).statusCode, 401)
  })

  it('bloque le brute-force au-delà de 5 tentatives', async () => {
    for (let i = 0; i < 5; i++) await login('mauvais')
    const res = await login('mauvais')
    assert.equal(res.statusCode, 429, 'le mot de passe admin doit être protégé du brute-force')
  })
})

describe('contrôle d\'accès', { skip: skip() }, () => {
  const protectedRoutes = [
    ['GET',    '/api/admin/dashboard'],
    ['GET',    '/api/admin/bans'],
    ['GET',    '/api/admin/logs'],
    ['POST',   '/api/admin/pixel/clear'],
    ['DELETE', '/api/admin/canvas'],
    ['POST',   '/api/admin/restore-canvas'],
    ['POST',   '/api/admin/ban/Alice'],
    ['DELETE', '/api/admin/ban/Alice'],
    ['PATCH',  '/api/admin/users/Alice/role'],
  ]

  it('refuse toute route admin sans token', async () => {
    for (const [method, url] of protectedRoutes) {
      const res = await app.inject({ method, url, headers: BROWSER_HEADERS, payload: {} })
      assert.equal(res.statusCode, 401, `${method} ${url} doit exiger un token`)
    }
  })

  it('refuse un token de simple utilisateur', async () => {
    for (const [method, url] of protectedRoutes) {
      const res = await app.inject({ method, url, headers: auth('user'), payload: {} })
      assert.equal(res.statusCode, 403, `${method} ${url} doit refuser le rôle user`)
    }
  })

  it('refuse un token signé avec un autre secret', async () => {
    const forged = jwt.sign({ role: 'superadmin' }, 'mauvais_secret')
    const res = await app.inject({
      method: 'GET', url: '/api/admin/dashboard',
      headers: { ...BROWSER_HEADERS, authorization: `Bearer ${forged}` },
    })
    assert.equal(res.statusCode, 401)
  })

  it('réserve les actions destructrices au superadmin', async () => {
    const superadminOnly = [
      ['DELETE', '/api/admin/canvas'],
      ['POST',   '/api/admin/restore-canvas'],
      ['PATCH',  '/api/admin/users/Alice/role'],
    ]
    for (const [method, url] of superadminOnly) {
      const res = await app.inject({ method, url, headers: auth('admin'), payload: { role: 'user' } })
      assert.equal(res.statusCode, 403, `${method} ${url} doit être réservé au superadmin`)
    }
  })
})

describe('POST /api/admin/pixel/clear', { skip: skip() }, () => {
  const clear = (body) =>
    app.inject({ method: 'POST', url: '/api/admin/pixel/clear', headers: auth('admin'), payload: body })

  it('remet le pixel à blanc et journalise l\'action', async () => {
    await setPixel(redis, { x: 5, y: 6, colorId: 9, username: 'Alice', source: 'web' })

    const res = await clear({ x: 5, y: 6, admin: 'Maxime' })
    assert.equal(res.statusCode, 200)

    const grid = await loadGrid(redis)
    assert.equal(grid[getPixelIndex(5, 6)], 0)

    const { rows } = await db.pool.query(`SELECT action, admin FROM moderation_logs`)
    assert.equal(rows[0].action, 'clear_pixel')
    assert.equal(rows[0].admin,  'Maxime')
  })

  it('rejette des coordonnées hors de la grille', async () => {
    // Sans borne, setrange écrit à un décalage arbitraire : Redis agrandit le
    // buffer jusqu'à cet index et l'on peut faire exploser la mémoire.
    for (const body of [{ x: 999999, y: 0 }, { x: -1, y: 0 }, { x: 0, y: GRID_SIZE }]) {
      const res = await clear(body)
      assert.equal(res.statusCode, 400, `${JSON.stringify(body)} doit être rejeté`)
    }
  })

  it('rejette des coordonnées non entières', async () => {
    for (const body of [{ x: 1.5, y: 0 }, { x: NaN, y: 0 }, { x: 'abc', y: 0 }, {}]) {
      assert.equal((await clear(body)).statusCode, 400, `${JSON.stringify(body)} doit être rejeté`)
    }
  })

  it('ne fait pas grossir la grille après un rejet', async () => {
    await clear({ x: 999999, y: 0 })
    const grid = await loadGrid(redis)
    assert.equal(grid.length, GRID_SIZE * GRID_SIZE, 'la grille doit garder sa taille')
  })
})

describe('DELETE /api/admin/canvas', { skip: skip() }, () => {
  it('vide le canvas et prévient les clients par un seul signal', async () => {
    await setPixel(redis, { x: 1, y: 1, colorId: 5, username: 'Alice', source: 'web' })

    const res = await app.inject({ method: 'DELETE', url: '/api/admin/canvas', headers: auth('superadmin') })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().cleared, GRID_SIZE * GRID_SIZE)

    const grid = await loadGrid(redis)
    assert.ok(grid.every(b => b === 0))

    const reloads = emitted.filter(e => e.event === 'canvas:reload')
    assert.equal(reloads.length, 1, 'un seul canvas:reload, pas un pixel:update par pixel')
    assert.equal(emitted.filter(e => e.event === 'pixel:update').length, 0)
  })
})

describe('POST /api/admin/restore-canvas', { skip: skip() }, () => {
  it('reconstruit la grille depuis pixel_history', async () => {
    await db.pool.query(
      `INSERT INTO pixel_history (x,y,color_id,username,source,placed_at) VALUES
       (3,4,7,'Alice','web',   NOW() - INTERVAL '2 hours'),
       (3,4,9,'Bob',  'web',   NOW() - INTERVAL '1 hour'),
       (10,10,2,'Carl','minecraft', NOW())`
    )

    const res = await app.inject({ method: 'POST', url: '/api/admin/restore-canvas', headers: auth('superadmin') })
    assert.equal(res.statusCode, 200)

    const grid = await loadGrid(redis)
    assert.equal(grid[getPixelIndex(3, 4)],   9, 'seule la dernière couleur posée compte')
    assert.equal(grid[getPixelIndex(10, 10)], 2)
  })
})

describe('bannissement', { skip: skip() }, () => {
  const ban   = (username, body = {}) =>
    app.inject({ method: 'POST', url: `/api/admin/ban/${username}`, headers: auth('admin'), payload: body })
  const unban = (username) =>
    app.inject({ method: 'DELETE', url: `/api/admin/ban/${username}`, headers: auth('admin') })

  it('bannit un joueur et journalise l\'action', async () => {
    const res = await ban('Tricheur', { reason: 'spam', banned_by: 'Maxime' })
    assert.equal(res.statusCode, 201)

    const { rows } = await db.pool.query('SELECT username, reason FROM bans')
    assert.equal(rows[0].username, 'Tricheur')
    assert.equal(rows[0].reason,   'spam')

    const logs = await db.pool.query(`SELECT action, target FROM moderation_logs WHERE action = 'ban'`)
    assert.equal(logs.rows[0].target, 'Tricheur')
  })

  it('pose une date d\'expiration pour un bannissement temporaire', async () => {
    await ban('Temporaire', { expires_in_days: 7 })
    const { rows } = await db.pool.query('SELECT expires_at FROM bans WHERE username = $1', ['Temporaire'])
    assert.ok(rows[0].expires_at instanceof Date, 'expires_at doit être renseigné')
    assert.ok(rows[0].expires_at > new Date(), 'et situé dans le futur')
  })

  it('met à jour un bannissement existant au lieu d\'échouer', async () => {
    await ban('Recidiviste', { reason: 'premier' })
    const res = await ban('Recidiviste', { reason: 'second' })
    assert.equal(res.statusCode, 201)

    const { rows } = await db.pool.query('SELECT reason FROM bans WHERE username = $1', ['Recidiviste'])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].reason, 'second')
  })

  it('débannit sans tenir compte de la casse', async () => {
    // La pose de pixel vérifie les bans en LOWER(...) : un débannissement
    // sensible à la casse laisserait le joueur bloqué sans trace visible.
    await ban('Alice')
    const res = await unban('alice')
    assert.equal(res.statusCode, 200, 'le débannissement doit ignorer la casse')

    const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM bans')
    assert.equal(rows[0].n, 0)
  })

  it('renvoie 404 pour un joueur qui n\'est pas banni', async () => {
    assert.equal((await unban('Inconnu')).statusCode, 404)
  })

  it('liste les bannissements en cours', async () => {
    await ban('A'); await ban('B')
    const res = await app.inject({ method: 'GET', url: '/api/admin/bans', headers: auth('admin') })
    assert.equal(res.json().bans.length, 2)
  })
})

describe('PATCH /api/admin/users/:username/role', { skip: skip() }, () => {
  beforeEach(async () => {
    if (db.skipped) return
    await db.pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['Alice', 'hash'])
  })

  const setRole = (username, role) =>
    app.inject({ method: 'PATCH', url: `/api/admin/users/${username}/role`, headers: auth('superadmin'), payload: { role } })

  it('change le rôle d\'un utilisateur', async () => {
    assert.equal((await setRole('Alice', 'admin')).statusCode, 200)
    const { rows } = await db.pool.query('SELECT role FROM users WHERE username = $1', ['Alice'])
    assert.equal(rows[0].role, 'admin')
  })

  it('rejette un rôle inconnu', async () => {
    assert.equal((await setRole('Alice', 'root')).statusCode, 400)
  })

  it('renvoie 404 pour un utilisateur inexistant', async () => {
    assert.equal((await setRole('Fantome', 'admin')).statusCode, 404)
  })
})

describe('journaux de modération', { skip: skip() }, () => {
  beforeEach(async () => {
    if (db.skipped) return
    await db.pool.query(`
      INSERT INTO moderation_logs (action, target, admin, reason) VALUES
      ('ban',         'Alice', 'Maxime', 'raison interne'),
      ('unban',       'Alice', 'Maxime', NULL),
      ('clear_pixel', NULL,    'Maxime', NULL)
    `)
  })

  it('renvoie tous les journaux à un administrateur', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/logs', headers: auth('admin') })
    assert.equal(res.json().logs.length, 3)
  })

  it('filtre par type d\'action', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/logs?action=ban', headers: auth('admin') })
    assert.equal(res.json().logs.length, 1)
  })

  it('tolère un paramètre limit invalide au lieu de renvoyer une erreur serveur', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/logs?limit=abc', headers: auth('admin') })
    assert.equal(res.statusCode, 200, 'un limit non numérique ne doit pas casser la requête SQL')
  })

  it('expose publiquement les bans sans révéler l\'administrateur', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/moderation/logs' })
    assert.equal(res.statusCode, 200)

    const logs = res.json().logs
    assert.equal(logs.length, 2, 'seuls ban et unban sont publics')
    for (const log of logs) {
      assert.ok(!('admin' in log), 'le nom de l\'administrateur ne doit pas fuiter')
    }
  })

  it('tolère un limit invalide sur la route publique', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/moderation/logs?limit=abc' })
    assert.equal(res.statusCode, 200)
  })
})

describe('GET /api/admin/dashboard', { skip: skip() }, () => {
  it('agrège les statistiques globales et par plateforme', async () => {
    await db.pool.query(`
      INSERT INTO pixel_history (x,y,color_id,username,source) VALUES
      (1,1,1,'Alice','web'), (2,2,2,'Alice','web'), (3,3,3,'Bob','minecraft')
    `)

    const res = await app.inject({ method: 'GET', url: '/api/admin/dashboard', headers: auth('admin') })
    assert.equal(res.statusCode, 200)

    const body = res.json()
    assert.equal(body.global.total_pixels,   3)
    assert.equal(body.global.unique_players, 2)

    const web = body.by_platform.find(p => p.source === 'web')
    assert.equal(web.pixels, 2)
  })
})
