// ── Feature : Unlocks ────────────────────────────────────────────────────────
// GET  /api/unlocks          → unlocks + streak du joueur connecté
// GET  /api/unlocks/tree     → arbre complet avec statut (public)
// GET  /api/unlocks/available → nœuds débloquables maintenant
// POST /api/unlocks/:nodeId  → débloquer un nœud (dépense le streak si besoin)

import jwt from 'jsonwebtoken'
import { TREE } from './tree.js'
import { getUnlocks, canUnlockNode, unlockNode } from './engine.js'

export async function unlockRoutes(fastify, { pool, JWT_SECRET }) {

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

    const [unlocked, userRow] = await Promise.all([
      getUnlocks(pool, username),
      pool.query(
        'SELECT streak_hours, last_pixel_at FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      ),
    ])

    const user = userRow.rows[0] ?? {}

    reply.send({
      unlocked:      [...unlocked],
      streak_hours:  user.streak_hours ?? 0,
      last_pixel_at: user.last_pixel_at ?? null,
    })
  })

  // Arbre complet avec statut (accessible sans compte pour l'affichage)
  // GET /api/unlocks/tree
  fastify.get('/api/unlocks/tree', async (req, reply) => {
    const username = getUsername(req)
    const unlocked = username ? await getUnlocks(pool, username) : new Set()

    const tree = Object.entries(TREE).map(([nodeId, node]) => ({
      nodeId,
      type:        node.type,
      level:       node.level ?? null,
      colorId:     node.colorId ?? null,
      name:        node.name,
      streakCost:  node.streakCost,
      conditions:  node.conditions,
      unlocked:    unlocked.has(nodeId),
    }))

    reply.send({ tree })
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
    reply.status(201).send({ ok: true, nodeId, name: result.name })
  })
}
