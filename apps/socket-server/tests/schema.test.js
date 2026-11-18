// Tests des migrations de schéma (src/shared/schema.js).
//
// Incident couvert (novembre 2026) : la base de production avait été créée par
// un ancien schéma. init.sql ne s'exécutant qu'à la création du volume, elle
// n'avait jamais reçu reports.status : la file des signalements répondait 500
// (« column "status" does not exist »), le bannissement aussi (ON CONFLICT
// (username) sans contrainte unique), et un signalement anonyme violait
// reports.reporter NOT NULL.
//
// Les tables « legacy » ci-dessous reproduisent la structure relevée en
// production (information_schema) le 18/11/2026.

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { buildTestApp, BROWSER_HEADERS, TEST_JWT_SECRET } from './helpers/app.js'
import { FakeRedis } from './helpers/redis-fake.js'
import { reportRoutes } from '../src/features/report/routes.js'
import { adminRoutes } from '../src/features/admin/routes.js'
import { setPixel, GRID_SIZE } from '../src/features/canvas/grid.js'
import { runSchemaMigrations, SCHEMA_MIGRATIONS, SchemaMigrationError } from '../src/shared/schema.js'

let db, app
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

const adminAuth = { authorization: `Bearer ${jwt.sign({ role: 'admin', username: 'Modo' }, TEST_JWT_SECRET, { expiresIn: '1h' })}` }

const TABLES = ['reports', 'bans', 'pixel_messages']

/** Structure observable des tables migrées : colonnes, nullabilité, clés, index. */
async function structure(pool) {
  const columns = await pool.query(`
    SELECT table_name, column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ANY($1)
    ORDER BY table_name, column_name
  `, [TABLES])
  const keys = await pool.query(`
    SELECT conrelid::regclass::text AS table_name, contype::text AS type, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE connamespace = current_schema()::regnamespace AND conrelid::regclass::text = ANY($1)
    ORDER BY 1, 3
  `, [TABLES])
  const indexes = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = current_schema() AND tablename = ANY($1) ORDER BY 1
  `, [TABLES])
  return { columns: columns.rows, keys: keys.rows, indexes: indexes.rows.map(r => r.indexname) }
}

/** Remplace les tables par la structure relevée en production. */
async function installLegacySchema(pool) {
  await pool.query(`
    DROP TABLE reports;
    CREATE TABLE reports (
      id              SERIAL PRIMARY KEY,
      reporter        TEXT NOT NULL,
      target_type     TEXT,
      target_username TEXT,
      x               INTEGER,
      y               INTEGER,
      reason          TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );
    DROP TABLE bans;
    CREATE TABLE bans (
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL,
      reason     TEXT,
      banned_by  TEXT,
      banned_at  TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    );
    DROP INDEX idx_pixel_messages_xy;
  `)
}

before(async () => {
  db = await startTestDatabase()
  if (db.skipped) return
  app = await buildTestApp([reportRoutes, adminRoutes], {
    pool: db.pool, redis: new FakeRedis(),
    io: { emit() {}, to: () => ({ emit() {} }), sockets: { sockets: { size: 0, get: () => null } } },
    usernameToSocket: new Map(),
    setPixel, GRID_SIZE,
    onRoleChanged() {},
  })
})

after(async () => {
  await app?.close()
  await db?.cleanup()
})

// Ordre volontaire : la base neuve d'abord, la base legacy ensuite (elle
// remplace des tables, et chaque fichier de test a sa propre base).
describe('runSchemaMigrations', { skip: skip() }, () => {
  let expected

  it('ne change rien à une base créée par init.sql, et note chaque migration', async () => {
    await truncateAll(db.pool)
    expected = await structure(db.pool)

    await runSchemaMigrations(db.pool)

    assert.deepEqual(await structure(db.pool), expected)
    const { rows } = await db.pool.query('SELECT id FROM schema_migrations ORDER BY id')
    assert.deepEqual(rows.map(r => r.id), SCHEMA_MIGRATIONS.map(m => m.id).sort())
  })

  it('aligne une base legacy sur init.sql sans perdre ses signalements', async () => {
    await installLegacySchema(db.pool)
    await truncateAll(db.pool)
    await db.pool.query(`INSERT INTO reports (reporter, target_type, x, y, reason) VALUES ('Alice', 'pixel', 3, 4, 'ancien')`)
    // Doublon exact : la nouvelle clé primaire ne garde que le plus récent
    await db.pool.query(`
      INSERT INTO bans (username, reason, banned_at) VALUES
        ('Tricheur', 'ancien', NOW() - INTERVAL '2 days'),
        ('Tricheur', 'recent', NOW())
    `)

    // La panne d'origine, reproduite avant migration
    const broken = await app.inject({ method: 'GET', url: '/api/admin/reports?status=pending', headers: adminAuth })
    assert.equal(broken.statusCode, 500)

    await runSchemaMigrations(db.pool)

    const after = await structure(db.pool)
    const names = (cols) => cols.map(c => `${c.table_name}.${c.column_name}`)
    assert.deepEqual(names(after.columns), names(expected.columns), 'mêmes colonnes qu\'init.sql')
    const nullable = (table, column) =>
      after.columns.find(c => c.table_name === table && c.column_name === column).is_nullable
    assert.equal(nullable('reports', 'reporter'), 'YES', 'signalement anonyme')
    assert.equal(nullable('reports', 'status'), 'NO')
    assert.deepEqual(after.keys, expected.keys, 'mêmes clés qu\'init.sql')
    assert.deepEqual(after.indexes, expected.indexes, 'mêmes index qu\'init.sql')

    const bans = await db.pool.query('SELECT username, reason FROM bans')
    assert.deepEqual(bans.rows, [{ username: 'Tricheur', reason: 'recent' }])

    const list = await app.inject({ method: 'GET', url: '/api/admin/reports?status=pending', headers: adminAuth })
    assert.equal(list.statusCode, 200)
    assert.deepEqual(list.json().reports.map(r => [r.reason, r.status]), [['ancien', 'pending']])
  })

  it('rend leur fonctionnement aux routes de modération sur la base migrée', async () => {
    const anonymous = await app.inject({
      method: 'POST', url: '/api/report', headers: BROWSER_HEADERS,
      payload: { target_type: 'pixel', x: 1, y: 2, reason: 'anonyme' },
    })
    assert.equal(anonymous.statusCode, 201, 'un signalement anonyme doit être accepté')

    const { id } = (await db.pool.query(`SELECT id FROM reports WHERE reason = 'anonyme'`)).rows[0]
    const review = await app.inject({ method: 'PATCH', url: `/api/admin/reports/${id}`, headers: adminAuth })
    assert.equal(review.statusCode, 200)

    const ban = await app.inject({ method: 'POST', url: '/api/admin/ban/Tricheur', headers: adminAuth, payload: { reason: 'encore' } })
    assert.equal(ban.statusCode, 201)
    const bans = await db.pool.query('SELECT username, reason FROM bans')
    assert.deepEqual(bans.rows, [{ username: 'Tricheur', reason: 'encore' }])
  })

  it('ne rejoue pas une migration déjà appliquée', async () => {
    let calls = 0
    const probe = [{ id: 'test-probe', up: async () => { calls++ } }]
    await runSchemaMigrations(db.pool, probe)
    await runSchemaMigrations(db.pool, probe)
    assert.equal(calls, 1)
  })

  it('annule en entier une migration en échec, s\'arrête là et explique pourquoi', async () => {
    let laterRan = false
    const migrations = [
      { id: 'test-ko', up: async (client) => {
        await client.query('ALTER TABLE reports ADD COLUMN demi_migration INT')
        await client.query('SELECT * FROM table_absente')
      } },
      { id: 'test-apres-ko', up: async () => { laterRan = true } },
    ]

    await assert.rejects(runSchemaMigrations(db.pool, migrations), (err) => {
      assert.ok(err instanceof SchemaMigrationError)
      assert.match(err.message, /« test-ko » en échec, annulée : base inchangée, API arrêtée/)
      assert.match(err.message, /table_absente/, 'la cause PostgreSQL figure dans le message')
      return true
    })

    const column = await db.pool.query(`
      SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'demi_migration'
    `)
    assert.equal(column.rowCount, 0, 'le DDL de la migration échouée est annulé')
    const noted = await db.pool.query(`SELECT id FROM schema_migrations WHERE id LIKE 'test-%ko'`)
    assert.equal(noted.rowCount, 0, 'une migration échouée n\'est pas notée comme faite')
    assert.equal(laterRan, false, 'les migrations suivantes ne tournent pas')

    // Le pool reste utilisable, et le verrou a été rendu
    const lock = await db.pool.query(`SELECT pg_try_advisory_lock(hashtext('voxelplace:schema-migrations')) AS ok`)
    assert.equal(lock.rows[0].ok, true)
    await db.pool.query(`SELECT pg_advisory_unlock_all()`)
  })

  it('fait attendre un second démarrage simultané au lieu de migrer deux fois', async () => {
    let running = 0, maxRunning = 0, calls = 0
    const slow = [{ id: 'test-concurrent', up: async () => {
      calls++
      running++
      maxRunning = Math.max(maxRunning, running)
      await new Promise(r => setTimeout(r, 100))
      running--
    } }]

    await Promise.all([runSchemaMigrations(db.pool, slow), runSchemaMigrations(db.pool, slow)])
    assert.equal(calls, 1, 'la seconde instance voit la migration déjà faite')
    assert.equal(maxRunning, 1)
  })
})
