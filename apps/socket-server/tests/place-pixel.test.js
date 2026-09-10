// Tests de la pose de pixel — le chemin le plus critique de l'application,
// et jusqu'ici le seul cœur métier sans aucune couverture.
//
// Couvre les règles qui protègent le jeu : identité vérifiée, cooldown,
// bannissement, et l'exemption des ponts de jeu (Minecraft).

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { FakeRedis } from './helpers/redis-fake.js'
import { placePixel, changedOwner } from '../src/features/canvas/place-pixel.js'
import { createCooldownController } from '../src/features/canvas/cooldown.js'
import { loadGrid, getPixelMeta, getPixelIndex } from '../src/features/canvas/grid.js'
import { getStats } from '../src/features/analytics/stats.js'

let db, redis, cooldown, deps, clock
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
  redis    = new FakeRedis()
  clock    = makeClock()
  cooldown = createCooldownController({ pool: db.pool, now: clock })
  deps     = { redis, pool: db.pool, cooldown }
  await loadGrid(redis)
})

/**
 * Attend qu'une condition devienne vraie, en interrogeant régulièrement.
 * L'insertion dans pixel_history est volontairement non attendue par le code :
 * un délai fixe suffirait la plupart du temps, mais pas quand toute la suite
 * s'exécute en parallèle — d'où cette attente conditionnelle.
 */
async function waitFor(condition, { timeout = 10_000, interval = 10 } = {}) {
  const deadline = Date.now() + timeout
  for (;;) {
    if (await condition()) return true
    if (Date.now() > deadline) return false
    await new Promise(r => setTimeout(r, interval))
  }
}

/**
 * Nombre de lignes d'historique à une coordonnée donnée.
 * On interroge une coordonnée propre au test plutôt que la table entière : une
 * écriture tardive d'un test voisin ne peut alors pas fausser le résultat.
 */
const countHistoryAt = async (x, y) => {
  const { rows } = await db.pool.query(
    'SELECT count(*)::int AS n FROM pixel_history WHERE x = $1 AND y = $2', [x, y]
  )
  return rows[0].n
}

const webPixel = (over = {}) => ({ x: 10, y: 20, colorId: 5, username: 'Alice', source: 'web', ...over })
const asAlice  = { verifiedUsername: 'Alice' }

async function createUser(username, role = 'user', streak = 0) {
  await db.pool.query(
    'INSERT INTO users (username, password_hash, role, streak_hours) VALUES ($1, $2, $3, $4)',
    [username, 'hash', role, streak]
  )
}

describe('placePixel — cas nominal', { skip: skip() }, () => {
  it('écrit le pixel dans la grille et ses métadonnées', async () => {
    await createUser('Alice')
    const res = await placePixel(deps, webPixel(), asAlice)
    assert.equal(res.ok, true)

    const grid = await loadGrid(redis)
    assert.equal(grid[getPixelIndex(10, 20)], 5)

    const meta = await getPixelMeta(redis, 10, 20)
    assert.equal(meta.username, 'Alice')
  })

  it('incrémente les compteurs par plateforme', async () => {
    await createUser('Alice')
    await placePixel(deps, webPixel(), asAlice)

    const stats = await getStats(redis)
    assert.equal(stats.total, 1)
    assert.equal(stats.byPlatform.web, 1)
  })

  it('journalise la pose dans pixel_history', async () => {
    await createUser('Alice')
    await placePixel(deps, webPixel({ x: 1777, y: 1333 }), asAlice)

    assert.ok(await waitFor(async () => (await countHistoryAt(1777, 1333)) === 1), 'la pose doit être journalisée')

    const { rows } = await db.pool.query(
      'SELECT username, color_id FROM pixel_history WHERE x = 1777 AND y = 1333'
    )
    assert.equal(rows[0].username, 'Alice')
  })

  it('renvoie le propriétaire précédent lors d\'un écrasement', async () => {
    await createUser('Alice'); await createUser('Bob')
    await placePixel(deps, webPixel(), asAlice)
    clock.advance(60_000)

    const res = await placePixel(deps, webPixel({ username: 'Bob', colorId: 9 }), { verifiedUsername: 'Bob' })
    assert.equal(res.ok, true)
    assert.equal(res.prevMeta.username, 'Alice')
    assert.ok(changedOwner(res.prevMeta, res.pixel))
  })
})

describe('placePixel — identité', { skip: skip() }, () => {
  it('refuse un visiteur non authentifié', async () => {
    const res = await placePixel(deps, webPixel(), { verifiedUsername: undefined })
    assert.equal(res.ok, false)
    assert.match(res.error, /Connexion requise/)
  })

  it("refuse de poser au nom d'un autre joueur", async () => {
    const res = await placePixel(deps, webPixel({ username: 'Victime' }), asAlice)
    assert.equal(res.ok, false)
    assert.match(res.error, /Identité non autorisée/)
  })

  it('accepte une différence de casse entre le token et le pseudo', async () => {
    await createUser('Alice')
    const res = await placePixel(deps, webPixel({ username: 'alice' }), asAlice)
    assert.equal(res.ok, true)
  })

  it('enregistre le pixel sous le pseudo du jeton, pas sous celui envoyé', async () => {
    // Sans cette normalisation, « alice » et « Alice » ouvrent deux
    // progressions distinctes : user_stats et user_color_counts sont indexées
    // sur le pseudo tel qu'il arrive.
    await createUser('Alice')
    const res = await placePixel(deps, webPixel({ username: 'ALICE' }), asAlice)
    assert.equal(res.ok, true)
    assert.equal(res.pixel.username, 'Alice', 'le pseudo canonique doit primer')

    const meta = await getPixelMeta(redis, 10, 20)
    assert.equal(meta.username, 'Alice')
  })

  it('laisse passer Minecraft sans JWT — le pont n\'a pas de session web', async () => {
    const res = await placePixel(deps, webPixel({ source: 'minecraft', username: 'Steve' }), {})
    assert.equal(res.ok, true)
  })
})

describe('placePixel — cooldown', { skip: skip() }, () => {
  it('refuse une seconde pose immédiate et indique l\'attente', async () => {
    await createUser('Alice')
    await placePixel(deps, webPixel(), asAlice)

    const res = await placePixel(deps, webPixel({ x: 11 }), asAlice)
    assert.equal(res.ok, false)
    assert.match(res.error, /Trop vite/)
    assert.ok(res.cooldown > 0)
  })

  it('réautorise la pose une fois le délai écoulé', async () => {
    await createUser('Alice')
    await placePixel(deps, webPixel(), asAlice)
    clock.advance(60_000)
    assert.equal((await placePixel(deps, webPixel({ x: 11 }), asAlice)).ok, true)
  })

  it('n\'applique aucun cooldown à Minecraft', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await placePixel(deps, webPixel({ x: i, source: 'minecraft', username: 'Steve' }), {})
      assert.equal(res.ok, true, `pose ${i} refusée`)
    }
  })

  it('n\'écrit rien quand la pose est refusée par le cooldown', async () => {
    await createUser('Alice')
    await placePixel(deps, webPixel(), asAlice)
    await placePixel(deps, webPixel({ x: 11, colorId: 9 }), asAlice)

    const grid = await loadGrid(redis)
    assert.equal(grid[getPixelIndex(11, 20)], 0, 'le pixel refusé ne doit pas apparaître')
  })
})

describe('placePixel — bannissement', { skip: skip() }, () => {
  it('refuse un joueur banni définitivement', async () => {
    await createUser('Tricheur')
    await db.pool.query('INSERT INTO bans (username, reason) VALUES ($1, $2)', ['Tricheur', 'spam'])

    const res = await placePixel(deps, webPixel({ username: 'Tricheur' }), { verifiedUsername: 'Tricheur' })
    assert.equal(res.ok, false)
    assert.match(res.error, /banni/)
  })

  it('laisse poser un joueur dont le bannissement a expiré', async () => {
    await createUser('Repenti')
    await db.pool.query(
      `INSERT INTO bans (username, reason, expires_at) VALUES ($1, $2, NOW() - INTERVAL '1 hour')`,
      ['Repenti', 'ancien spam']
    )
    const res = await placePixel(deps, webPixel({ username: 'Repenti' }), { verifiedUsername: 'Repenti' })
    assert.equal(res.ok, true)
  })

  it('bannit sans tenir compte de la casse du pseudo', async () => {
    await createUser('Tricheur')
    await db.pool.query('INSERT INTO bans (username) VALUES ($1)', ['TRICHEUR'])
    const res = await placePixel(deps, webPixel({ username: 'tricheur' }), { verifiedUsername: 'tricheur' })
    assert.equal(res.ok, false)
  })
})

describe('placePixel — données invalides', { skip: skip() }, () => {
  it('rejette coordonnées hors grille, couleur hors palette et pseudo vide', async () => {
    const cas = [
      webPixel({ x: -1 }),
      webPixel({ y: 2048 }),
      webPixel({ colorId: 16 }),
      webPixel({ colorId: -1 }),
      webPixel({ x: 1.5 }),
      webPixel({ username: '' }),
      null,
    ]
    for (const data of cas) {
      const res = await placePixel(deps, data, asAlice)
      assert.equal(res.ok, false, `aurait dû rejeter : ${JSON.stringify(data)}`)
    }
  })

  it('ne laisse aucune trace en base après un rejet', async () => {
    await placePixel(deps, webPixel({ x: 1888, y: 1444, colorId: 99 }), asAlice)

    // Rien ne doit apparaître : on laisse une fenêtre large pour qu'une
    // insertion parasite ait le temps de se manifester si elle existe.
    const appeared = await waitFor(async () => (await countHistoryAt(1888, 1444)) > 0, { timeout: 500 })
    assert.equal(appeared, false, 'un pixel rejeté ne doit rien journaliser')
  })
})

describe('changedOwner', () => {
  it('détecte un changement de propriétaire', () => {
    assert.equal(changedOwner({ username: 'Alice' }, { username: 'Bob' }),   true)
    assert.equal(changedOwner({ username: 'Alice' }, { username: 'alice' }), false)
    assert.equal(changedOwner(null,                  { username: 'Alice' }), false)
    assert.equal(changedOwner({ username: null },    { username: 'Alice' }), false)
  })
})
