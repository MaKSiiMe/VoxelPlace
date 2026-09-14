// Tests de la migration qui préserve l'existant avant le verrouillage des
// couleurs : un joueur ne doit perdre aucune couleur qu'il a déjà posée.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { grantPlayedColors, runUnlockMigrations } from '../src/features/unlocks/migrations.js'
import { runOnce } from '../src/shared/migrations.js'
import { getUnlocks } from '../src/features/unlocks/engine.js'

let db
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

before(async () => { db = await startTestDatabase() })
after(async () => { await db?.cleanup() })

beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
})

const createUser = (username) =>
  db.pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, 'hash'])

const history = (username, colorId, source = 'web') => db.pool.query(
  'INSERT INTO pixel_history (x, y, color_id, username, source) VALUES (1, 1, $1, $2, $3)',
  [colorId, username, source]
)

const colorsOf = async (username) =>
  [...await getUnlocks(db.pool, username)].filter(n => n.startsWith('color:')).sort()

const countUnlocks = async () =>
  (await db.pool.query('SELECT count(*)::int AS n FROM user_unlocks')).rows[0].n

describe('grantPlayedColors', { skip: skip() }, () => {
  it('accorde chaque couleur déjà posée, et les couleurs de base', async () => {
    await createUser('Alice')
    await history('Alice', 6)
    await history('Alice', 6)
    await history('Alice', 15)

    await grantPlayedColors(db.pool)
    assert.deepEqual(await colorsOf('Alice'),
      ['color:0', 'color:12', 'color:15', 'color:3', 'color:5', 'color:6', 'color:7'])
  })

  it('rattache l\'historique au compte quelle que soit la casse, sous le pseudo canonique', async () => {
    await createUser('Alice')
    await history('alice', 6)
    await grantPlayedColors(db.pool)

    const { rows } = await db.pool.query(`SELECT username FROM user_unlocks WHERE node_id = 'color:6'`)
    assert.deepEqual(rows, [{ username: 'Alice' }], 'user_unlocks est indexée sur la casse de users')
  })

  it('ignore les pseudos effacés, les comptes inexistants et les ponts de jeu', async () => {
    await createUser('Steve')
    await history(null, 6)                      // compte effacé (RGPD)
    await history('Fantome', 8)                 // aucun compte web
    await history('Steve', 9, 'minecraft')      // homonyme Minecraft, sans compte

    await grantPlayedColors(db.pool)
    assert.deepEqual(await colorsOf('Steve'), ['color:0', 'color:12', 'color:3', 'color:5', 'color:7'])
    const { rows } = await db.pool.query(`SELECT count(*)::int AS n FROM user_unlocks WHERE username IS NULL OR username = 'Fantome'`)
    assert.equal(rows[0].n, 0)
  })

  it('préfère pixel_history à user_color_counts, qui ne compte que depuis le moteur', async () => {
    await createUser('Alice')
    await history('Alice', 10)   // posé avant l'arrivée du moteur : absent des compteurs
    await grantPlayedColors(db.pool)
    assert.ok((await colorsOf('Alice')).includes('color:10'))
  })

  it('est idempotente', async () => {
    await createUser('Alice')
    await history('Alice', 6)
    await grantPlayedColors(db.pool)
    const first = await countUnlocks()

    const second = await grantPlayedColors(db.pool)
    assert.equal(await countUnlocks(), first)
    assert.deepEqual(second, { base: 0, played: 0 })
  })

  it('ne retire rien à un joueur qui a déjà débloqué des couleurs', async () => {
    await createUser('Alice')
    await db.pool.query(`INSERT INTO user_unlocks (username, node_id) VALUES ('Alice', 'color:13'), ('Alice', 'feature:heatmap')`)
    await grantPlayedColors(db.pool)
    const unlocked = await getUnlocks(db.pool, 'Alice')
    assert.ok(unlocked.has('color:13') && unlocked.has('feature:heatmap'))
  })
})

describe('runUnlockMigrations', { skip: skip() }, () => {
  it('ne s\'applique qu\'une fois : un pixel posé ensuite n\'accorde plus rien', async () => {
    await createUser('Alice')
    await history('Alice', 6)
    await runUnlockMigrations(db.pool)
    assert.ok((await colorsOf('Alice')).includes('color:6'))

    // Posé plus tard sous un rôle qui a toutes les couleurs, puis rôle retiré :
    // un redémarrage ne doit pas transformer ce droit temporaire en déblocage.
    await history('Alice', 14)
    await runUnlockMigrations(db.pool)
    assert.ok(!(await colorsOf('Alice')).includes('color:14'))
  })
})

describe('runOnce', { skip: skip() }, () => {
  it('ne marque pas comme appliquée une migration qui échoue', async () => {
    await assert.rejects(runOnce(db.pool, 'test-echec', async () => { throw new Error('boom') }))

    let ran = false
    assert.equal(await runOnce(db.pool, 'test-echec', async () => { ran = true }), true)
    assert.ok(ran, 'elle doit être retentée au démarrage suivant')
  })

  it('annule les écritures d\'une migration qui échoue', async () => {
    await createUser('Alice')
    await assert.rejects(runOnce(db.pool, 'test-annulation', async (client) => {
      await client.query(`INSERT INTO user_unlocks (username, node_id) VALUES ('Alice', 'color:6')`)
      throw new Error('boom')
    }))
    assert.equal(await countUnlocks(), 0)
  })

  it('n\'exécute pas deux fois une migration lancée en parallèle', async () => {
    let runs = 0
    const migrate = async (client) => { runs++; await client.query('SELECT pg_sleep(0.05)') }
    await Promise.all([runOnce(db.pool, 'test-parallele', migrate), runOnce(db.pool, 'test-parallele', migrate)])
    assert.equal(runs, 1)
  })
})
