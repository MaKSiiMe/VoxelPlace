import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Server } from 'socket.io'
import Redis from 'ioredis'
import { loadGrid, setPixel, getPixelMeta, GRID_SIZE } from './grid.js'
import { isValidCoord, sanitizeUsername, validatePixel } from './utils.js'
import { authRoutes } from './auth.js'
import { pool, connectWithRetry } from './db.js'

const PORT       = parseInt(process.env.PORT || '3001', 10)
const REDIS_URL  = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod'

// Comptes sans cooldown (ex: comptes de test ou bots internes)
const TEST_USERNAMES = new Set(
  (process.env.TEST_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean)
)

// --- Palette de couleurs (ID 0-7) ---
const COLORS = [
  '#FFFFFF', // 0 blanc
  '#000000', // 1 noir
  '#FF4444', // 2 rouge
  '#00AA00', // 3 vert
  '#4444FF', // 4 bleu
  '#FFFF00', // 5 jaune
  '#FF8800', // 6 orange
  '#AA00AA', // 7 violet
]

// --- Redis ---
const redis = new Redis(REDIS_URL)
redis.on('connect', () => console.log(`[Redis] Connecté à ${REDIS_URL}`))
redis.on('error',   (err) => console.error('[Redis] Erreur :', err.message))

// --- Fastify ---
const fastify = Fastify({ logger: false })
await fastify.register(cors, { origin: '*', methods: ['GET', 'POST'] })

// --- Auth routes (PostgreSQL) ---
await authRoutes(fastify, { pool, jwtSecret: JWT_SECRET })

// --- Socket.io ---
const io = new Server(fastify.server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

// --- Joueurs connectés ---
// socketId → { username, source }
const connectedPlayers = new Map()

function getPlayersPayload() {
  const byPlatform = {}
  for (const { source } of connectedPlayers.values()) {
    byPlatform[source] = (byPlatform[source] ?? 0) + 1
  }
  return { count: connectedPlayers.size, byPlatform }
}

function broadcastPlayers() {
  io.emit('players:update', getPlayersPayload())
}

// --- Stats pixels par plateforme ---

const STATS_KEY = 'voxelplace:stats:pixels'

async function getStats() {
  const raw = await redis.hgetall(STATS_KEY)
  if (!raw) return { total: 0, byPlatform: {} }
  const { total = '0', ...rest } = raw
  const byPlatform = Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, parseInt(v)])
  )
  return { total: parseInt(total), byPlatform }
}

// --- Routes REST ---

fastify.get('/api/grid', async (_req, reply) => {
  const buf = await loadGrid(redis)
  reply.send({ grid: Array.from(buf), size: GRID_SIZE, colors: COLORS })
})

fastify.get('/api/stats', async (_req, reply) => {
  reply.send(await getStats())
})

// Heatmap : nombre de pixels posés par coordonnée
fastify.get('/api/heatmap', async (_req, reply) => {
  const result = await pool.query(
    'SELECT x, y, COUNT(*)::int AS count FROM pixel_history GROUP BY x, y'
  )
  reply.send({ heatmap: result.rows })
})

// Pulse : pixels par minute sur les 3 dernières heures
fastify.get('/api/pulse', async (_req, reply) => {
  const result = await pool.query(`
    SELECT date_trunc('minute', placed_at) AS t, COUNT(*)::int AS count
    FROM pixel_history
    WHERE placed_at > NOW() - INTERVAL '3 hours'
    GROUP BY t ORDER BY t
  `)
  reply.send({ pulse: result.rows })
})

// Snapshot : état exact du canvas à un timestamp donné
fastify.get('/api/snapshot', async (req, reply) => {
  const { at } = req.query
  if (!at) return reply.status(400).send({ error: 'Paramètre "at" requis' })
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (x, y) x, y, color_id AS "colorId"
      FROM pixel_history
      WHERE placed_at <= $1
      ORDER BY x, y, placed_at DESC
    `, [at])
    const grid = new Array(GRID_SIZE * GRID_SIZE).fill(0)
    for (const { x, y, colorId } of result.rows) {
      grid[y * GRID_SIZE + x] = colorId
    }
    reply.send({ grid, size: GRID_SIZE, at })
  } catch {
    reply.status(400).send({ error: 'Timestamp invalide' })
  }
})

// Zones de conflit : pixels écrasés par un utilisateur différent
fastify.get('/api/conflicts', async (_req, reply) => {
  const result = await pool.query(`
    SELECT x, y, COUNT(*)::int AS count
    FROM (
      SELECT x, y, username,
             LAG(username) OVER (PARTITION BY x, y ORDER BY placed_at) AS prev_username
      FROM pixel_history
    ) t
    WHERE prev_username IS NOT NULL AND username != prev_username
    GROUP BY x, y
  `)
  reply.send({ conflicts: result.rows })
})

// Historique complet pour le timelapse
fastify.get('/api/history', async (req, reply) => {
  const limit = Math.min(parseInt(req.query.limit ?? '10000'), 50000)
  const result = await pool.query(
    `SELECT x, y, color_id AS "colorId", username, source,
            placed_at AS "placedAt"
     FROM pixel_history ORDER BY placed_at ASC LIMIT $1`,
    [limit]
  )
  reply.send({ history: result.rows, total: result.rowCount })
})

// Historique d'un seul pixel (git blame)
fastify.get('/api/pixel/:x/:y/history', async (req, reply) => {
  const x = parseInt(req.params.x, 10)
  const y = parseInt(req.params.y, 10)
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
    return reply.status(400).send({ error: 'Coordonnées invalides' })
  }
  const result = await pool.query(
    `SELECT color_id AS "colorId", username, source, placed_at AS "placedAt"
     FROM pixel_history WHERE x = $1 AND y = $2 ORDER BY placed_at DESC LIMIT 50`,
    [x, y]
  )
  reply.send({ x, y, history: result.rows })
})

fastify.get('/api/pixel/:x/:y', async (req, reply) => {
  const x = parseInt(req.params.x, 10)
  const y = parseInt(req.params.y, 10)
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
    return reply.status(400).send({ error: 'Coordonnées invalides' })
  }
  const meta = await getPixelMeta(redis, x, y)
  reply.send(meta || { x, y, colorId: 0, username: null, source: null })
})

// --- Helpers de validation (voir src/utils.js) ---

// --- Rate limiting ---
const lastPlaced = new Map()
const COOLDOWN_MS = 1000

function checkRateLimit(username) {
  // Les comptes de test n'ont pas de cooldown
  if (TEST_USERNAMES.has(username)) return 0

  const now  = Date.now()
  const last = lastPlaced.get(username) ?? 0
  if (now - last < COOLDOWN_MS) {
    return Math.ceil((COOLDOWN_MS - (now - last)) / 1000)
  }
  lastPlaced.set(username, now)
  return 0
}

setInterval(() => {
  const cutoff = Date.now() - COOLDOWN_MS * 2
  for (const [user, ts] of lastPlaced) {
    if (ts < cutoff) lastPlaced.delete(user)
  }
}, 60_000)

// --- Socket.io événements ---
io.on('connection', async (socket) => {
  console.log(`[Socket] Connecté : ${socket.id}`)

  // Grille initiale + état des joueurs + stats
  const buf = await loadGrid(redis)
  socket.emit('grid:init', {
    grid:    Array.from(buf),
    size:    GRID_SIZE,
    colors:  COLORS,
    players: getPlayersPayload(),
    stats:   await getStats(),
  })

  // Le client annonce son pseudo et sa plateforme
  socket.on('player:join', ({ username, source } = {}) => {
    if (typeof username !== 'string' || !username.trim()) return
    const cleanSource = ['web', 'minecraft', 'roblox', 'hytale'].includes(source)
      ? source
      : 'web'
    connectedPlayers.set(socket.id, {
      username: sanitizeUsername(username),
      source:   cleanSource,
    })
    broadcastPlayers()
  })

  // Authentification admin
  socket.on('admin:auth', (password, ack) => {
    const expected = process.env.ADMIN_PASSWORD
    if (!expected || password !== expected) {
      console.warn(`[Admin] Tentative échouée depuis ${socket.id}`)
      return ack?.({ error: 'Mot de passe incorrect' })
    }
    socket.data.isAdmin = true
    console.log(`[Admin] Accès accordé à ${socket.id}`)
    ack?.({ ok: true })
  })

  // Suppression admin
  socket.on('admin:clear', async ({ x, y } = {}, ack) => {
    if (!socket.data.isAdmin) return ack?.({ error: 'Non autorisé' })
    if (!isValidCoord(x) || !isValidCoord(y)) return ack?.({ error: 'Coordonnées invalides' })
    try {
      const pixel = { x, y, colorId: 0, username: '[admin]', source: 'moderation' }
      await setPixel(redis, pixel)
      io.emit('pixel:update', pixel)
      console.log(`[Admin] Pixel (${x},${y}) remis à blanc`)
      ack?.({ ok: true })
    } catch (err) {
      console.error('[admin:clear]', err)
      ack?.({ error: 'Erreur serveur' })
    }
  })

  // Remise à zéro complète (admin)
  socket.on('admin:clearAll', async (_, ack) => {
    if (!socket.data.isAdmin) return ack?.({ error: 'Non autorisé' })
    try {
      const total = GRID_SIZE * GRID_SIZE
      for (let i = 0; i < total; i++) {
        const x = i % GRID_SIZE
        const y = Math.floor(i / GRID_SIZE)
        const pixel = { x, y, colorId: 0, username: '[admin]', source: 'moderation' }
        await setPixel(redis, pixel)
        io.emit('pixel:update', pixel)
      }
      console.log('[Admin] Canvas entièrement remis à zéro')
      ack?.({ ok: true })
    } catch (err) {
      console.error('[admin:clearAll]', err)
      ack?.({ error: 'Erreur serveur' })
    }
  })

  // Placement de pixel
  socket.on('pixel:place', async (data, ack) => {
    const pixel = validatePixel(data)
    if (!pixel) return ack?.({ error: 'Données invalides' })

    const wait = checkRateLimit(pixel.username)
    if (wait > 0) return ack?.({ error: `Trop vite ! Attends ${wait}s.`, cooldown: wait })

    try {
      await setPixel(redis, pixel)
      await redis.hincrby(STATS_KEY, pixel.source, 1)
      await redis.hincrby(STATS_KEY, 'total', 1)
      // Historique PostgreSQL — fire-and-forget pour ne pas bloquer le pixel:place
      pool.query(
        'INSERT INTO pixel_history (x, y, color_id, username, source) VALUES ($1, $2, $3, $4, $5)',
        [pixel.x, pixel.y, pixel.colorId, pixel.username, pixel.source]
      ).catch(err => console.error('[pixel_history]', err.message))
      io.emit('pixel:update', pixel)
      io.emit('stats:update', await getStats())
      ack?.({ ok: true, exempt: TEST_USERNAMES.has(pixel.username) })
    } catch (err) {
      console.error('[pixel:place]', err)
      ack?.({ error: 'Erreur serveur' })
    }
  })

  socket.on('disconnect', () => {
    console.log(`[Socket] Déconnecté : ${socket.id}`)
    connectedPlayers.delete(socket.id)
    broadcastPlayers()
  })
})

// --- Démarrage ---
try {
  await connectWithRetry()
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`[Fastify] Serveur démarré sur http://0.0.0.0:${PORT}`)
  if (TEST_USERNAMES.size > 0) {
    console.log(`[Rate limit] Comptes exemptés : ${[...TEST_USERNAMES].join(', ')}`)
  }
} catch (err) {
  console.error(err)
  process.exit(1)
}
