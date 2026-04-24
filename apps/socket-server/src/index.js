import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Server } from 'socket.io'
import Redis from 'ioredis'
import { loadGrid, setPixel, getPixelMeta, GRID_SIZE } from './features/canvas/grid.js'
import { isValidCoord, sanitizeUsername, validatePixel } from './features/canvas/utils.js'
import { authRoutes } from './features/auth/routes.js'
import { playerRoutes } from './features/players/routes.js'
import { timelapseRoutes } from './features/timelapse/routes.js'
import { zoneRoutes } from './features/zone/routes.js'
import { shareRoutes } from './features/share/routes.js'
import { adminRoutes } from './features/admin/routes.js'
import { globalDashboardRoutes } from './features/dashboard/global.js'
import { playerDashboardRoutes } from './features/dashboard/player.js'
import { pool, connectWithRetry } from './shared/db.js'
import { PALETTE_HEX as COLORS } from './shared/palette.js'
import { registerChatEvents } from './features/chat/events.js'
import { initPixelChatTable, registerPixelChatEvents, resetPixelThread } from './features/chat/pixelChat.js'
import { initUnlockTables, processPixelPlaced, processPixelLost, processPixelOverwritten, checkFeatureUnlocks } from './features/unlocks/engine.js'
import { unlockRoutes } from './features/unlocks/routes.js'
import { reportRoutes } from './features/report/routes.js'
import { profileRoutes } from './features/profile/routes.js'

const PORT            = parseInt(process.env.PORT || '3001', 10)
const REDIS_URL       = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const JWT_SECRET      = process.env.JWT_SECRET || 'dev_secret_change_in_prod'
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000']

// Comptes sans cooldown (ex: comptes de test ou bots internes)
const TEST_USERNAMES = new Set(
  (process.env.TEST_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean)
)

// --- Redis ---
const redis = new Redis(REDIS_URL)
redis.on('connect', () => console.log(`[Redis] Connecté à ${REDIS_URL}`))
redis.on('error',   (err) => console.error('[Redis] Erreur :', err.message))

// --- Fastify ---
const fastify = Fastify({ logger: false })
await fastify.register(cors, { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST', 'PATCH', 'DELETE'] })

// --- Routes REST (features) ---
await authRoutes(fastify, { pool, jwtSecret: JWT_SECRET })
await playerRoutes(fastify, { pool })
await timelapseRoutes(fastify, { pool })
await zoneRoutes(fastify, { pool, redis, gridSize: GRID_SIZE })
await shareRoutes(fastify, { pool, redis, gridSize: GRID_SIZE })

// --- Socket.io ---
const io = new Server(fastify.server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 64e6, // 64MB pour grid:init (4MB buffer → ~8MB JSON)
})

// --- Joueurs connectés ---
// socketId → { username, source }
const connectedPlayers = new Map()
// username → socketId (pour les notifications ciblées)
const usernameToSocket = new Map()

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

// Fenêtre de la grille : retourne seulement les pixels dans la zone demandée
// GET /api/grid/window?x=896&z=896&w=256&h=256
fastify.get('/api/grid/window', async (req, reply) => {
  const ox = Math.max(0, parseInt(req.query.x ?? 0, 10))
  const oz = Math.max(0, parseInt(req.query.z ?? 0, 10))
  const w  = Math.min(2048, parseInt(req.query.w ?? 64, 10))
  const h  = Math.min(2048, parseInt(req.query.h ?? 64, 10))

  const buf    = await loadGrid(redis)
  const window = new Array(w * h)
  for (let dz = 0; dz < h; dz++) {
    for (let dx = 0; dx < w; dx++) {
      window[dz * w + dx] = buf[(oz + dz) * GRID_SIZE + (ox + dx)] ?? 0
    }
  }
  reply.send({ grid: window, offsetX: ox, offsetZ: oz, width: w, height: h, colors: COLORS })
})

fastify.get('/api/stats', async (_req, reply) => {
  reply.send(await getStats())
})

// Heatmap : nombre de pixels posés par coordonnée
// GET /api/heatmap?since=24h&username=Steve
// since : 1h | 24h | 7d | 30d | all (défaut: all)
fastify.get('/api/heatmap', async (req, reply) => {
  const { since, username } = req.query

  const conditions = []
  const params     = []

  if (username) {
    params.push(username)
    conditions.push(`LOWER(username) = LOWER($${params.length})`)
  }

  const intervals = { '1h': '1 hour', '24h': '24 hours', '7d': '7 days', '30d': '30 days' }
  if (since && intervals[since]) {
    conditions.push(`placed_at > NOW() - INTERVAL '${intervals[since]}'`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await pool.query(
    `SELECT x, y, COUNT(*)::int AS count FROM pixel_history ${where} GROUP BY x, y ORDER BY count DESC`,
    params
  )
  reply.send({ heatmap: result.rows, filters: { since: since ?? 'all', username: username ?? null } })
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

// --- Rate limiting par rôle ---

const lastPlaced = new Map()

// Réduction streak pour les users normaux : 0h=60s | 5h=45s | 10h=30s | 20h=20s
function cooldownForStreak(streakHours) {
  if (streakHours >= 20) return 20_000
  if (streakHours >= 10) return 30_000
  if (streakHours >= 5)  return 45_000
  return ROLE_COOLDOWNS.user
}

// Cache role + streak_hours en mémoire (TTL 2 min)
const userCache     = new Map()
const USER_TTL_MS   = 2 * 60 * 1000

async function getUserCached(username) {
  const cached = userCache.get(username.toLowerCase())
  if (cached && Date.now() - cached.fetchedAt < USER_TTL_MS) return cached.data

  try {
    const { rows } = await pool.query(
      'SELECT role, streak_hours FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    )
    const data = { role: rows[0]?.role ?? 'user', streak: rows[0]?.streak_hours ?? 0 }
    userCache.set(username.toLowerCase(), { data, fetchedAt: Date.now() })
    return data
  } catch {
    return { role: 'user', streak: 0 }
  }
}

import { ROLE_COOLDOWNS, SUPERUSER_PREFIXES } from '@voxelplace/types/roles'

// Retourne le cooldown actif en ms (0 = peut placer)
async function checkRateLimit(username) {
  if (TEST_USERNAMES.has(username)) return { wait: 0, cooldownMs: 0 }

  const { role, streak } = await getUserCached(username)

  // Si le pseudo a un préfixe superuser mais que la DB n'est pas encore à jour, on applique quand même le bon cooldown
  const effectiveRole = (role === 'user' && SUPERUSER_PREFIXES.some(p => username.toLowerCase().startsWith(p)))
    ? 'superuser'
    : role

  let cooldownMs = ROLE_COOLDOWNS[effectiveRole] ?? ROLE_COOLDOWNS.user
  // Les users normaux bénéficient de la réduction par streak
  if (effectiveRole === 'user') cooldownMs = cooldownForStreak(streak)
  // superadmin : aucun cooldown
  if (cooldownMs === 0) return { wait: 0, cooldownMs: 0 }

  const now  = Date.now()
  const last = lastPlaced.get(username) ?? 0
  const elapsed = now - last
  if (elapsed < cooldownMs) {
    return { wait: cooldownMs - elapsed, cooldownMs }
  }
  lastPlaced.set(username, now)
  return { wait: 0, cooldownMs }
}

setInterval(() => {
  const placedCutoff = Date.now() - 120_000
  for (const [user, ts] of lastPlaced) {
    if (ts < placedCutoff) lastPlaced.delete(user)
  }
  const cacheCutoff = Date.now() - USER_TTL_MS
  for (const [user, entry] of userCache) {
    if (entry.fetchedAt < cacheCutoff) userCache.delete(user)
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
    const cleanUsername = sanitizeUsername(username)
    connectedPlayers.set(socket.id, { username: cleanUsername, source: cleanSource })
    usernameToSocket.set(cleanUsername.toLowerCase(), socket.id)
    broadcastPlayers()
  })

  // Renvoie la grille au client qui la demande (après canvas:reload)
  socket.on('grid:request', async () => {
    const buf = await loadGrid(redis)
    socket.emit('grid:init', {
      grid:    Array.from(buf),
      size:    GRID_SIZE,
      colors:  COLORS,
      players: getPlayersPayload(),
      stats:   await getStats(),
    })
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

    const { wait, cooldownMs } = pixel.source === 'minecraft'
      ? { wait: 0, cooldownMs: 0 }
      : await checkRateLimit(pixel.username)
    if (wait > 0) return ack?.({ error: `Trop vite ! Attends ${Math.ceil(wait / 1000)}s.`, cooldown: wait })

    // Vérifie si le joueur est banni
    const ban = await pool.query(
      `SELECT expires_at FROM bans WHERE LOWER(username) = LOWER($1)
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [pixel.username]
    )
    if (ban.rows.length > 0) return ack?.({ error: 'Vous êtes banni.' })

    try {
      // Récupère le propriétaire actuel avant d'écraser
      const prevMeta = await getPixelMeta(redis, pixel.x, pixel.y)

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

      // Reset le thread pixel:chat si le pixel change de propriétaire
      if (prevMeta?.username?.toLowerCase() !== pixel.username.toLowerCase()) {
        resetPixelThread(io, pool, pixel.x, pixel.y).catch(err => console.error('[pixel:chat:reset]', err.message))
      }

      // Unlocks — traitement async fire-and-forget
      if (pixel.username) {
        processPixelPlaced(pool, pixel.username, pixel.colorId, pixel.x, pixel.y)
          .then(() => checkFeatureUnlocks(pool, pixel.username))
          .then(newUnlocks => {
            if (newUnlocks.length > 0) {
              const socketId = usernameToSocket.get(pixel.username.toLowerCase())
              if (socketId) io.to(socketId).emit('unlocks:new', { unlocks: newUnlocks })
            }
          })
          .catch(err => console.error('[unlocks]', err.message))

        if (prevMeta?.username && prevMeta.username.toLowerCase() !== pixel.username.toLowerCase()) {
          processPixelLost(pool, prevMeta.username).catch(() => {})
          processPixelOverwritten(pool, pixel.username).catch(() => {})
          // Invalide le cache streak du joueur
          userCache.delete(pixel.username.toLowerCase())
        }
      }

      // Notification si un joueur connecté s'est fait écraser son pixel
      if (
        prevMeta?.username &&
        prevMeta.username.toLowerCase() !== pixel.username.toLowerCase()
      ) {
        const targetSocketId = usernameToSocket.get(prevMeta.username.toLowerCase())
        if (targetSocketId) {
          io.to(targetSocketId).emit('pixel:overwritten', {
            x:         pixel.x,
            y:         pixel.y,
            colorId:   pixel.colorId,
            by:        pixel.username,
            source:    pixel.source,
          })
        }
      }

      const { role, streak: streakHours } = await getUserCached(pixel.username)
      ack?.({ ok: true, role, streak_hours: streakHours, cooldown: cooldownMs })
    } catch (err) {
      console.error('[pixel:place]', err)
      ack?.({ error: 'Erreur serveur' })
    }
  })

  // Chat global / zone
  registerChatEvents(io, socket, connectedPlayers)
  // Chat par pixel
  registerPixelChatEvents(io, socket, connectedPlayers, pool, usernameToSocket)

  socket.on('disconnect', () => {
    console.log(`[Socket] Déconnecté : ${socket.id}`)
    const player = connectedPlayers.get(socket.id)
    if (player) usernameToSocket.delete(player.username.toLowerCase())
    connectedPlayers.delete(socket.id)
    broadcastPlayers()
  })
})

await adminRoutes(fastify, { pool, io, usernameToSocket, JWT_SECRET, redis, setPixel, GRID_SIZE })
await unlockRoutes(fastify, { pool, JWT_SECRET })
await reportRoutes(fastify, { pool, JWT_SECRET })
await profileRoutes(fastify, { pool })
await globalDashboardRoutes(fastify, { pool })
await playerDashboardRoutes(fastify, { pool, gridSize: GRID_SIZE })

// --- Démarrage ---
try {
  await connectWithRetry()
  await initPixelChatTable(pool)
  await initUnlockTables(pool)
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`[Fastify] Serveur démarré sur http://0.0.0.0:${PORT}`)
  if (TEST_USERNAMES.size > 0) {
    console.log(`[Rate limit] Comptes exemptés : ${[...TEST_USERNAMES].join(', ')}`)
  }
} catch (err) {
  console.error(err)
  process.exit(1)
}
