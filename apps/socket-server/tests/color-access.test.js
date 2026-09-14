// Tests de l'accès aux couleurs : le verrouillage de la palette par l'arbre de
// progression, appliqué côté serveur.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { createColorAccess } from '../src/features/unlocks/color-access.js'
import { unlockBaseNodes } from '../src/features/unlocks/engine.js'

let db, access, clock
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

function makeClock(start = 1_000_000) {
  let t = start
  const fn = () => t
  fn.advance = (ms) => { t += ms }
  return fn
}

before(async () => { db = await startTestDatabase() })
after(async () => { await db?.cleanup() })

beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
  access?.stop()
  clock  = makeClock()
  access = createColorAccess({ pool: db.pool, now: clock })
})

async function createUser(username, role = 'user') {
  await db.pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, 'hash', role])
  await unlockBaseNodes(db.pool, username)
}

const grant = (username, colorId) => db.pool.query(
  'INSERT INTO user_unlocks (username, node_id) VALUES ($1, $2)', [username, `color:${colorId}`]
)

describe('createColorAccess', { skip: skip() }, () => {
  it('accepte les couleurs de base d\'un compte neuf', async () => {
    await createUser('Alice')
    for (const id of [0, 3, 5, 7, 12]) assert.equal(await access.canUse('Alice', id), true, `couleur ${id}`)
  })

  it('refuse une couleur non débloquée', async () => {
    await createUser('Alice')
    assert.equal(await access.canUse('Alice', 6), false)
    assert.deepEqual([...await access.colorsOf('Alice')].sort((a, b) => a - b), [0, 3, 5, 7, 12])
  })

  it('accepte une couleur débloquée', async () => {
    await createUser('Alice')
    await grant('Alice', 6)
    assert.equal(await access.canUse('Alice', 6), true)
  })

  it('garde les couleurs de base à un compte sans aucune ligne de progression', async () => {
    // Comptes antérieurs au moteur de progression
    await db.pool.query(`INSERT INTO users (username, password_hash) VALUES ('Ancien', 'hash')`)
    assert.equal(await access.canUse('Ancien', 5), true)
    assert.equal(await access.canUse('Ancien', 6), false)
  })

  it('ignore la casse du pseudo', async () => {
    await createUser('Alice')
    await grant('Alice', 6)
    assert.equal(await access.canUse('ALICE', 6), true)
  })

  for (const role of ['superuser', 'admin', 'superadmin']) {
    it(`donne les 16 couleurs au rôle ${role}`, async () => {
      await createUser('Staff', role)
      assert.equal((await access.colorsOf('Staff')).size, 16)
    })
  }

  it('rend sa progression réelle à un joueur dont le rôle est retiré', async () => {
    await createUser('Staff', 'superuser')
    assert.equal(await access.canUse('Staff', 6), true)

    await db.pool.query(`UPDATE users SET role = 'user' WHERE username = 'Staff'`)
    access.invalidate('Staff')
    assert.equal(await access.canUse('Staff', 6), false, 'rien n\'a été écrit en base pendant le rôle')
  })
})

describe('cache des couleurs', { skip: skip() }, () => {
  it('sert la valeur en cache tant qu\'elle n\'est pas invalidée', async () => {
    await createUser('Alice')
    assert.equal(await access.canUse('Alice', 6), false)

    await grant('Alice', 6)
    assert.equal(await access.canUse('Alice', 6), false, 'le cache évite une requête par pixel')

    access.invalidate('alice')
    assert.equal(await access.canUse('Alice', 6), true, 'invalider rend la couleur tout de suite')
  })

  it('expire au bout de deux minutes', async () => {
    await createUser('Alice')
    await access.canUse('Alice', 6)
    await grant('Alice', 6)
    clock.advance(2 * 60 * 1000)
    assert.equal(await access.canUse('Alice', 6), true)
  })

  it('retombe sur les couleurs de base si la base est injoignable, sans le mettre en cache', async () => {
    let failing = true
    const pool = { query: async (...args) => { if (failing) throw new Error('down'); return db.pool.query(...args) } }
    const flaky = createColorAccess({ pool, now: clock })
    await createUser('Alice')
    await grant('Alice', 6)

    assert.equal(await flaky.canUse('Alice', 5), true,  'le jeu continue avec les couleurs de base')
    assert.equal(await flaky.canUse('Alice', 6), false, 'rien n\'est offert par erreur')

    failing = false
    assert.equal(await flaky.canUse('Alice', 6), true, 'la panne n\'a pas été mise en cache')
    flaky.stop()
  })
})
