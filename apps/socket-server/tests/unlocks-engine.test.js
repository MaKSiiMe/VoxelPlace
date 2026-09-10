// Tests du moteur de progression : streak, compteurs, conditions de déblocage.
// C'est la logique de jeu la plus complexe du projet (325 lignes) et elle
// n'était couverte par rien.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import {
  unlockBaseNodes, processPixelPlaced, processPixelLost,
  processPixelOverwritten, getUnlocks, checkFeatureUnlocks,
} from '../src/features/unlocks/engine.js'
import { TREE, BASE_COLOR_NODES, BASE_FEATURE_NODES } from '../src/features/unlocks/tree.js'

let db
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

before(async () => { db = await startTestDatabase() })
after(async () => { await db?.cleanup() })

beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
})

async function createUser(username = 'Alice') {
  await db.pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, 'hash'])
}

const streakOf = async (username) => {
  const { rows } = await db.pool.query(
    'SELECT streak_hours FROM users WHERE LOWER(username) = LOWER($1)', [username]
  )
  return rows[0]?.streak_hours
}

describe('unlockBaseNodes', { skip: skip() }, () => {
  it('offre les 5 couleurs de base et le chat à la création du compte', async () => {
    await createUser()
    await unlockBaseNodes(db.pool, 'Alice')

    const unlocked = await getUnlocks(db.pool, 'Alice')
    for (const node of [...BASE_COLOR_NODES, ...BASE_FEATURE_NODES]) {
      assert.ok(unlocked.has(node), `${node} doit être débloqué d'entrée`)
    }
    assert.equal(unlocked.size, 6)
  })

  it('est idempotent — un second appel ne duplique rien', async () => {
    await createUser()
    await unlockBaseNodes(db.pool, 'Alice')
    await unlockBaseNodes(db.pool, 'Alice')
    assert.equal((await getUnlocks(db.pool, 'Alice')).size, 6)
  })
})

describe('processPixelPlaced', { skip: skip() }, () => {
  it('incrémente le compteur de la couleur posée', async () => {
    await createUser()
    await processPixelPlaced(db.pool, 'Alice', 5, 10, 10)
    await processPixelPlaced(db.pool, 'Alice', 5, 11, 10)

    const { rows } = await db.pool.query(
      'SELECT count FROM user_color_counts WHERE username = $1 AND color_id = $2', ['Alice', 5]
    )
    assert.equal(rows[0].count, 2)
  })

  it('compte les pixels posés et les jours joués', async () => {
    await createUser()
    await processPixelPlaced(db.pool, 'Alice', 5, 10, 10)

    const { rows } = await db.pool.query('SELECT pixels_placed, days_played FROM user_stats WHERE username = $1', ['Alice'])
    assert.equal(rows[0].pixels_placed, 1)
    assert.equal(rows[0].days_played.length, 1)
  })

  it('distingue les zones de 64×64 sans compter deux fois la même', async () => {
    await createUser()
    await processPixelPlaced(db.pool, 'Alice', 5, 10,  10)   // zone 0:0
    await processPixelPlaced(db.pool, 'Alice', 5, 20,  20)   // zone 0:0 également
    await processPixelPlaced(db.pool, 'Alice', 5, 200, 200)  // zone 3:3

    const { rows } = await db.pool.query('SELECT zones_visited FROM user_stats WHERE username = $1', ['Alice'])
    assert.equal(rows[0].zones_visited.length, 2, 'deux zones distinctes visitées')
  })
})

describe('streak', { skip: skip() }, () => {
  it('démarre à 0 : la première pose n\'a fait écouler aucune heure', async () => {
    await createUser()
    await processPixelPlaced(db.pool, 'Alice', 5, 1, 1)
    assert.equal(await streakOf('Alice'), 0)
  })

  it("n'augmente pas deux fois dans la même heure", async () => {
    await createUser()
    await processPixelPlaced(db.pool, 'Alice', 5, 1, 1)
    await processPixelPlaced(db.pool, 'Alice', 5, 2, 2)
    await processPixelPlaced(db.pool, 'Alice', 5, 3, 3)
    assert.equal(await streakOf('Alice'), 0, 'le streak se compte en heures, pas en pixels')
  })

  it('augmente au passage à une nouvelle heure', async () => {
    await createUser()
    await processPixelPlaced(db.pool, 'Alice', 5, 1, 1)

    // Recule le repère d'une heure : le prochain pixel tombe dans une heure neuve
    await db.pool.query(`
      UPDATE users SET last_pixel_hour = last_pixel_hour - INTERVAL '1 hour',
                       last_pixel_at   = last_pixel_at   - INTERVAL '1 hour'
      WHERE username = 'Alice'
    `)
    await processPixelPlaced(db.pool, 'Alice', 5, 2, 2)
    assert.equal(await streakOf('Alice'), 1, 'une heure de jeu supplémentaire')
  })

  it('repart de zéro après 24 h sans poser de pixel', async () => {
    await createUser()
    await processPixelPlaced(db.pool, 'Alice', 5, 1, 1)
    await db.pool.query(`UPDATE users SET streak_hours = 15,
      last_pixel_at = NOW() - INTERVAL '25 hours',
      last_pixel_hour = NOW() - INTERVAL '25 hours' WHERE username = 'Alice'`)

    await processPixelPlaced(db.pool, 'Alice', 5, 2, 2)
    assert.equal(await streakOf('Alice'), 0, 'une absence de 24 h remet le streak à zéro')
  })

  it('survit à une absence de 23 h', async () => {
    await createUser()
    await processPixelPlaced(db.pool, 'Alice', 5, 1, 1)
    await db.pool.query(`UPDATE users SET streak_hours = 15,
      last_pixel_at = NOW() - INTERVAL '23 hours',
      last_pixel_hour = NOW() - INTERVAL '23 hours' WHERE username = 'Alice'`)

    await processPixelPlaced(db.pool, 'Alice', 5, 2, 2)
    assert.equal(await streakOf('Alice'), 16)
  })
})

describe('pixels perdus et écrasés', { skip: skip() }, () => {
  it('compte les pixels perdus et ceux écrasés séparément', async () => {
    await createUser()
    await processPixelLost(db.pool, 'Alice')
    await processPixelLost(db.pool, 'Alice')
    await processPixelOverwritten(db.pool, 'Alice')

    const { rows } = await db.pool.query(
      'SELECT pixels_lost, pixels_overwritten FROM user_stats WHERE username = $1', ['Alice']
    )
    assert.equal(rows[0].pixels_lost,        2)
    assert.equal(rows[0].pixels_overwritten, 1)
  })
})

describe('checkFeatureUnlocks', { skip: skip() }, () => {
  it('ne débloque rien pour un joueur qui vient de commencer', async () => {
    await createUser()
    await unlockBaseNodes(db.pool, 'Alice')
    const before = await getUnlocks(db.pool, 'Alice')

    await checkFeatureUnlocks(db.pool, 'Alice')
    assert.equal((await getUnlocks(db.pool, 'Alice')).size, before.size)
  })

  it('débloque une feature dès que sa condition de pixels posés est atteinte', async () => {
    await createUser()
    await unlockBaseNodes(db.pool, 'Alice')

    // Cherche une feature automatique conditionnée uniquement au nombre de pixels
    const [nodeId, node] = Object.entries(TREE).find(([id, n]) =>
      n.type === 'feature' && n.streakCost === 0 &&
      n.conditions.length === 1 && n.conditions[0].type === 'pixels_placed' &&
      !BASE_FEATURE_NODES.includes(id)
    ) ?? []

    if (!nodeId) return // aucun nœud de cette forme dans l'arbre

    await db.pool.query(
      `INSERT INTO user_stats (username, pixels_placed) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET pixels_placed = $2`,
      ['Alice', node.conditions[0].min]
    )

    const newUnlocks = await checkFeatureUnlocks(db.pool, 'Alice')
    assert.ok(newUnlocks.some(u => u.nodeId === nodeId), `${nodeId} aurait dû se débloquer`)
    assert.ok((await getUnlocks(db.pool, 'Alice')).has(nodeId), 'et être persisté')
  })

  it('ne redébloque pas une feature déjà acquise', async () => {
    await createUser()
    await unlockBaseNodes(db.pool, 'Alice')
    await db.pool.query(
      `INSERT INTO user_stats (username, pixels_placed, pixels_lost, pixels_overwritten)
       VALUES ($1, 10000, 10000, 10000)`, ['Alice']
    )
    await checkFeatureUnlocks(db.pool, 'Alice')
    const second = await checkFeatureUnlocks(db.pool, 'Alice')
    assert.deepEqual(second, [], 'un second passage ne doit rien redébloquer')
  })

  it('ne débloque jamais automatiquement un nœud qui coûte du streak', async () => {
    await createUser()
    await unlockBaseNodes(db.pool, 'Alice')
    await db.pool.query(
      `INSERT INTO user_stats (username, pixels_placed, pixels_lost, pixels_overwritten)
       VALUES ($1, 99999, 99999, 99999)`, ['Alice']
    )
    const unlocks = await checkFeatureUnlocks(db.pool, 'Alice')
    for (const { nodeId } of unlocks) {
      assert.equal(TREE[nodeId].streakCost, 0, `${nodeId} coûte du streak et doit rester manuel`)
    }
  })
})

describe('cohérence de casse', { skip: skip() }, () => {
  it('ouvre deux progressions si le pseudo arrive sous deux casses', async () => {
    // Comportement assumé du moteur : il fait confiance à la casse reçue.
    // La normalisation est faite en amont par placePixel, à partir du pseudo
    // du jeton — voir la vérification correspondante dans place-pixel.test.js.
    await createUser('Alice')
    await processPixelPlaced(db.pool, 'Alice', 5, 1, 1)
    await processPixelPlaced(db.pool, 'alice', 5, 2, 2)

    const { rows } = await db.pool.query(
      `SELECT count(*)::int AS lignes FROM user_stats WHERE LOWER(username) = 'alice'`
    )
    assert.equal(rows[0].lignes, 2, 'le moteur ne normalise pas : c\'est le rôle de placePixel')
  })
})
