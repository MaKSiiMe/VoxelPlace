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

// --- Routes REST ---

fastify.get('/api/grid', async (_req, reply) => {
  const buf = await loadGrid(redis)
  reply.send({ grid: Array.from(buf), size: GRID_SIZE, colors: COLORS })
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

  // Grille initiale + état des joueurs
  const buf = await loadGrid(redis)
  socket.emit('grid:init', {
    grid:    Array.from(buf),
    size:    GRID_SIZE,
    colors:  COLORS,
    players: getPlayersPayload(),
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
      io.emit('pixel:update', pixel)
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
