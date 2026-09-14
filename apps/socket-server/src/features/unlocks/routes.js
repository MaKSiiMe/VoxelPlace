// ── Feature : Unlocks ────────────────────────────────────────────────────────
// GET  /api/unlocks          → unlocks, couleurs utilisables et streak du joueur connecté
// GET  /api/unlocks/tree     → arbre complet avec statut et progression (public)
// GET  /api/unlocks/available → nœuds débloquables maintenant
// POST /api/unlocks/:nodeId  → débloquer un nœud (dépense le streak si besoin)

import jwt from 'jsonwebtoken'
import { TREE, BASE_COLOR_IDS } from './tree.js'
import { getUnlocks, canUnlockNode, unlockNode, loadPlayerMetrics, evaluateCondition } from './engine.js'

const sorted = (set) => [...set].sort((a, b) => a - b)

export async function unlockRoutes(fastify, { pool, JWT_SECRET, colorAccess }) {

  function getUsername(req) {
    const auth = req.headers['authorization']
    if (!auth?.startsWith('Bearer ')) return null
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET)
      return payload.username ?? null
    } catch { return null }
  }

  // Unlocks + streak du joueur connecté
  // GET /api/unlocks
  fastify.get('/api/unlocks', async (req, reply) => {
    const username = getUsername(req)
    if (!username) return reply.status(401).send({ error: 'Non connecté' })

    const [unlocked, userRow, colors] = await Promise.all([
      getUnlocks(pool, username),
      pool.query(
        'SELECT streak_hours, last_pixel_at FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      ),
      colorAccess.colorsOf(username),
    ])

    const user = userRow.rows[0] ?? {}

    reply.send({
      unlocked:      [...unlocked],
      colors:        sorted(colors),
      streak_hours:  user.streak_hours ?? 0,
      last_pixel_at: user.last_pixel_at ?? null,
    })
  })

  // Arbre complet avec statut (accessible sans compte pour l'affichage).
  // Connecté, chaque condition porte sa progression : { met, current, target }.
  // `colors` liste les couleurs posables — les couleurs de base pour un visiteur,
  // qui voit ainsi la palette d'un compte neuf.
  // GET /api/unlocks/tree
  fastify.get('/api/unlocks/tree', async (req, reply) => {
    const username = getUsername(req)
    const [unlocked, metrics, colors, streak] = username
      ? await Promise.all([
          getUnlocks(pool, username),
          loadPlayerMetrics(pool, username),
          colorAccess.colorsOf(username),
          pool.query('SELECT streak_hours FROM users WHERE LOWER(username) = LOWER($1)', [username])
            .then(r => r.rows[0]?.streak_hours ?? 0),
        ])
      : [new Set(), null, new Set(BASE_COLOR_IDS), null]

    const tree = []
    for (const [nodeId, node] of Object.entries(TREE)) {
      const conditions = []
      for (const cond of node.conditions) {
        conditions.push(metrics
          ? { ...cond, ...(await evaluateCondition(cond, metrics, unlocked)) }
          : cond)
      }
      tree.push({
        nodeId,
        type:        node.type,
        level:       node.level ?? null,
        colorId:     node.colorId ?? null,
        name:        node.name,
        streakCost:  node.streakCost,
        comingSoon:  node.comingSoon === true,
        conditions,
        unlocked:    unlocked.has(nodeId),
      })
    }

    reply.send({ tree, colors: sorted(colors), streak_hours: streak })
  })

  // Nœuds débloquables maintenant pour ce joueur
  // GET /api/unlocks/available
  fastify.get('/api/unlocks/available', async (req, reply) => {
    const username = getUsername(req)
    if (!username) return reply.status(401).send({ error: 'Non connecté' })

    const available = []
    for (const nodeId of Object.keys(TREE)) {
      const check = await canUnlockNode(pool, username, nodeId)
      if (check.ok) available.push(nodeId)
    }

    reply.send({ available })
  })

  // Débloquer un nœud
  // POST /api/unlocks/:nodeId
  fastify.post('/api/unlocks/:nodeId', async (req, reply) => {
    const username = getUsername(req)
    if (!username) return reply.status(401).send({ error: 'Non connecté' })

    const { nodeId } = req.params
    const result = await unlockNode(pool, username, nodeId)

    if (!result.ok) return reply.status(400).send({ error: result.error })
    // Sans cela, la couleur tout juste payée resterait refusée à la pose
    // jusqu'à l'expiration du cache.
    colorAccess.invalidate(username)
    reply.status(201).send({ ok: true, nodeId, name: result.name })
  })
}
