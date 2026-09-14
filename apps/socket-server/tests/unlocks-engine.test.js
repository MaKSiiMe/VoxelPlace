// Tests du moteur de progression : streak, compteurs, conditions de déblocage.
// C'est la logique de jeu la plus complexe du projet (325 lignes) et elle
// n'était couverte par rien.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import {
  unlockBaseNodes, processPixelPlaced, processPixelLost,
  processPixelOverwritten, getUnlocks, checkFeatureUnlocks,
  canUnlockNode, unlockNode, loadPlayerMetrics, evaluateCondition,
} from '../src/features/unlocks/engine.js'
import { TREE, BASE_COLOR_NODES, BASE_COLOR_IDS } from '../src/features/unlocks/tree.js'

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
  it('offre les 5 couleurs de base à la création du compte', async () => {
    await createUser()
    await unlockBaseNodes(db.pool, 'Alice')

    const unlocked = await getUnlocks(db.pool, 'Alice')
    for (const node of BASE_COLOR_NODES) {
      assert.ok(unlocked.has(node), `${node} doit être débloqué d'entrée`)
    }
    assert.equal(unlocked.size, 5, 'le chat, en sommeil, n\'est plus offert')
  })

  it('est idempotent — un second appel ne duplique rien', async () => {
    await createUser()
    await unlockBaseNodes(db.pool, 'Alice')
    await unlockBaseNodes(db.pool, 'Alice')
    assert.equal((await getUnlocks(db.pool, 'Alice')).size, 5)
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

// Un arbre minimal : l'arbre réel n'a, pour l'instant, aucune fonctionnalité
// livrée — elles sont toutes « à venir » et ne se débloquent pas.
const TEST_TREE = {
  ...Object.fromEntries(Object.entries(TREE).filter(([, n]) => n.type === 'color')),
  'feature:auto':   { type: 'feature', name: 'Auto',   streakCost: 0, conditions: [{ type: 'pixels_placed', min: 10 }] },
  'feature:payant': { type: 'feature', name: 'Payant', streakCost: 3, conditions: [{ type: 'pixels_placed', min: 10 }] },
  'feature:bientot': { type: 'feature', name: 'Bientôt', comingSoon: true, streakCost: 0, conditions: [{ type: 'pixels_placed', min: 10 }] },
}

const setStats = (username, pixels) => db.pool.query(
  `INSERT INTO user_stats (username, pixels_placed, pixels_lost, pixels_overwritten)
   VALUES ($1, $2, $2, $2)
   ON CONFLICT (username) DO UPDATE SET pixels_placed = $2, pixels_lost = $2, pixels_overwritten = $2`,
  [username, pixels]
)

describe('checkFeatureUnlocks', { skip: skip() }, () => {
  it('ne débloque rien pour un joueur qui vient de commencer', async () => {
    await createUser()
    await unlockBaseNodes(db.pool, 'Alice')
    assert.deepEqual(await checkFeatureUnlocks(db.pool, 'Alice', TEST_TREE), [])
    assert.equal((await getUnlocks(db.pool, 'Alice')).size, 5)
  })

  it('débloque une feature dès que sa condition de pixels posés est atteinte', async () => {
    await createUser()
    await setStats('Alice', 10)

    const newUnlocks = await checkFeatureUnlocks(db.pool, 'Alice', TEST_TREE)
    assert.deepEqual(newUnlocks, [{ nodeId: 'feature:auto', name: 'Auto' }])
    assert.ok((await getUnlocks(db.pool, 'Alice')).has('feature:auto'), 'et être persisté')
  })

  it('ne redébloque pas une feature déjà acquise', async () => {
    await createUser()
    await setStats('Alice', 10_000)
    assert.equal((await checkFeatureUnlocks(db.pool, 'Alice', TEST_TREE)).length, 1)
    assert.deepEqual(await checkFeatureUnlocks(db.pool, 'Alice', TEST_TREE), [], 'un second passage ne doit rien redébloquer')
  })

  it('ne débloque jamais automatiquement un nœud qui coûte du streak', async () => {
    await createUser()
    await setStats('Alice', 99_999)
    const unlocks = await checkFeatureUnlocks(db.pool, 'Alice', TEST_TREE)
    assert.ok(!unlocks.some(u => u.nodeId === 'feature:payant'))
  })

  it('ne débloque ni n\'annonce une fonctionnalité à venir', async () => {
    await createUser()
    await setStats('Alice', 99_999)
    const unlocks = await checkFeatureUnlocks(db.pool, 'Alice', TEST_TREE)
    assert.ok(!unlocks.some(u => u.nodeId === 'feature:bientot'), 'annoncer « Débloqué » sans rien donner vendait du vide')
    assert.ok(!(await getUnlocks(db.pool, 'Alice')).has('feature:bientot'))
  })

  it('sur l\'arbre réel, n\'annonce que les fonctionnalités livrées', async () => {
    await createUser()
    await setStats('Alice', 99_999)
    await db.pool.query(`UPDATE user_stats SET days_played = '["a","b","c"]', zones_visited = '["1","2","3","4","5","6","7","8","9","10"]' WHERE username = 'Alice'`)
    const delivered = Object.entries(TREE)
      .filter(([, n]) => n.type === 'feature' && !n.comingSoon && n.streakCost === 0)
      .map(([id]) => id)
    const unlocks = await checkFeatureUnlocks(db.pool, 'Alice')
    assert.deepEqual(unlocks.map(u => u.nodeId).sort(), delivered.sort())
    for (const { nodeId } of unlocks) assert.ok(!TREE[nodeId].comingSoon, `${nodeId} est encore à venir`)
  })
})

describe('canUnlockNode / unlockNode', { skip: skip() }, () => {
  it('refuse une fonctionnalité à venir, même conditions remplies', async () => {
    await createUser()
    await setStats('Alice', 99_999)
    const res = await canUnlockNode(db.pool, 'Alice', 'feature:bientot', TEST_TREE)
    assert.deepEqual(res, { ok: false, error: 'Bientôt disponible' })
  })

  it('refuse un identifiant hérité du prototype d\'objet', async () => {
    await createUser()
    for (const nodeId of ['constructor', 'toString', '__proto__']) {
      assert.deepEqual(await canUnlockNode(db.pool, 'Alice', nodeId), { ok: false, error: 'Nœud inconnu' })
    }
  })

  it('débloque une couleur contre son coût en streak, conditions remplies', async () => {
    await db.pool.query(`INSERT INTO users (username, password_hash, streak_hours) VALUES ('Alice', 'hash', 5)`)
    await db.pool.query(`INSERT INTO user_color_counts (username, color_id, count) VALUES ('Alice', 5, 10), ('Alice', 7, 10)`)

    const res = await unlockNode(db.pool, 'Alice', 'color:6')   // orange : 10 rouges, 10 jaunes, 2 h
    assert.equal(res.ok, true)
    assert.equal(await streakOf('Alice'), 3)
    assert.ok((await getUnlocks(db.pool, 'Alice')).has('color:6'))
  })

  it('refuse une couleur dont une condition manque, sans dépenser le streak', async () => {
    await db.pool.query(`INSERT INTO users (username, password_hash, streak_hours) VALUES ('Alice', 'hash', 5)`)
    await db.pool.query(`INSERT INTO user_color_counts (username, color_id, count) VALUES ('Alice', 5, 10), ('Alice', 7, 9)`)

    const res = await unlockNode(db.pool, 'Alice', 'color:6')
    assert.deepEqual(res, { ok: false, error: 'Conditions non remplies' })
    assert.equal(await streakOf('Alice'), 5)
  })
})

describe('evaluateCondition', { skip: skip() }, () => {
  it('donne la progression des conditions chiffrées', async () => {
    await createUser()
    await db.pool.query(`INSERT INTO user_color_counts (username, color_id, count) VALUES ('Alice', 5, 7)`)
    const metrics = await loadPlayerMetrics(db.pool, 'Alice')

    assert.deepEqual(await evaluateCondition({ type: 'color_count', colorId: 5, min: 10 }, metrics, new Set()),
      { met: false, current: 7, target: 10 })
    assert.deepEqual(await evaluateCondition({ type: 'color_count', colorId: 7, min: 10 }, metrics, new Set()),
      { met: false, current: 0, target: 10 }, 'une couleur jamais posée compte zéro')
    assert.deepEqual(await evaluateCondition({ type: 'color_unlocked', colorId: 13 }, metrics, new Set(['color:13'])),
      { met: true })
  })

  it('classe le joueur d\'après pixel_history pour rank_top', async () => {
    await createUser()
    await db.pool.query(`INSERT INTO pixel_history (x, y, color_id, username) VALUES
      (0, 0, 5, 'Bob'), (1, 0, 5, 'Bob'), (2, 0, 5, 'Alice')`)
    const metrics = await loadPlayerMetrics(db.pool, 'Alice')
    assert.deepEqual(await evaluateCondition({ type: 'rank_top', max: 1 }, metrics, new Set()),
      { met: false, current: 2, target: 1 })
    assert.equal((await evaluateCondition({ type: 'rank_top', max: 2 }, metrics, new Set())).met, true)
  })

  it('ne remplit jamais une condition inconnue', async () => {
    await createUser()
    const metrics = await loadPlayerMetrics(db.pool, 'Alice')
    assert.deepEqual(await evaluateCondition({ type: 'inventee' }, metrics, new Set()), { met: false })
  })
})

describe('forme de l\'arbre', () => {
  it('ne contient plus les fonctionnalités libres ni le chat', () => {
    for (const nodeId of ['feature:leaderboard', 'feature:stats', 'feature:minimap',
      'feature:pixel_blame', 'feature:chat_global', 'feature:chat_pixel']) {
      assert.ok(!(nodeId in TREE), `${nodeId} ne doit plus figurer dans l'arbre`)
    }
  })

  it('ne référence que des nœuds et des couleurs qui existent', () => {
    for (const [nodeId, node] of Object.entries(TREE)) {
      for (const cond of node.conditions) {
        if (cond.nodeId)              assert.ok(cond.nodeId in TREE, `${nodeId} dépend de ${cond.nodeId}, absent`)
        if (cond.colorId !== undefined) assert.ok(`color:${cond.colorId}` in TREE, `${nodeId} : couleur ${cond.colorId} inconnue`)
      }
    }
  })

  it('couvre les 16 couleurs de la palette, dont 5 de base', () => {
    const colorIds = Object.values(TREE).filter(n => n.type === 'color').map(n => n.colorId).sort((a, b) => a - b)
    assert.deepEqual(colorIds, [...Array(16).keys()])
    assert.deepEqual([...BASE_COLOR_IDS].sort((a, b) => a - b), [0, 3, 5, 7, 12])
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
