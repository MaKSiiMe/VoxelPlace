import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Server } from 'socket.io'
import Redis from 'ioredis'
import { loadGrid, setPixel, clearGrid, GRID_SIZE } from './features/canvas/grid.js'
import { isValidCoord } from './features/canvas/utils.js'
import { authRoutes } from './features/auth/routes.js'
import { createSocketAuth } from './features/auth/socket-auth.js'
import { resolvePlayerIdentity } from './features/auth/player-identity.js'
import { registerPresence, unregisterPresence, presencePayload } from './features/players/presence.js'
import { playerRoutes } from './features/players/routes.js'
import { timelapseRoutes } from './features/timelapse/routes.js'
import { zoneRoutes } from './features/zone/routes.js'
import { shareRoutes } from './features/share/routes.js'
import { adminRoutes } from './features/admin/routes.js'
import { globalDashboardRoutes } from './features/dashboard/global.js'
import { playerDashboardRoutes } from './features/dashboard/player.js'
import { createCooldownController } from './features/canvas/cooldown.js'
import { canvasRoutes } from './features/canvas/routes.js'
import { placePixel, changedOwner } from './features/canvas/place-pixel.js'
import { analyticsRoutes } from './features/analytics/routes.js'
import { getStats } from './features/analytics/stats.js'
import { healthRoutes } from './features/health/routes.js'
import { pool, connectWithRetry } from './shared/db.js'
import { constantTimeEqual } from './shared/crypto.js'
import { logger } from './shared/logger.js'
import { checkRateLimit as checkAuthRateLimit } from './features/auth/rate-limit.js'
import { PALETTE_HEX as COLORS } from './shared/palette.js'
import { registerChatEvents } from './features/chat/events.js'
import { initPixelChatTable, registerPixelChatEvents, resetPixelThread } from './features/chat/pixelChat.js'
import { initUnlockTables, processPixelPlaced, processPixelLost, processPixelOverwritten, checkFeatureUnlocks } from './features/unlocks/engine.js'
import { unlockRoutes } from './features/unlocks/routes.js'
import { createColorAccess } from './features/unlocks/color-access.js'
import { runUnlockMigrations } from './features/unlocks/migrations.js'
import { reportRoutes } from './features/report/routes.js'
import { profileRoutes } from './features/profile/routes.js'

const PORT            = parseInt(process.env.PORT || '3001', 10)
const REDIS_URL       = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const JWT_SECRET      = process.env.JWT_SECRET || 'dev_secret_change_in_prod'
// Secret partagé avec les ponts de jeu. Absent, aucun socket ne peut se
// présenter comme pont : les poses venues de Minecraft sont refusées.
const BRIDGE_TOKEN    = process.env.BRIDGE_TOKEN || ''
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000']

// Comptes sans cooldown (ex: comptes de test ou bots internes)
const TEST_USERNAMES = new Set(
  (process.env.TEST_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean)
)

// --- Redis ---
const redis = new Redis(REDIS_URL)
redis.on('connect', () => logger.info('Redis connecté'))
redis.on('error',   (err) => logger.error({ err: err.message }, 'Redis injoignable'))

// --- Fastify ---
// logger partagé : Fastify trace chaque requête, et le reste du serveur
// écrit dans le même flux (voir shared/logger.js)
const fastify = Fastify({ loggerInstance: logger })
await fastify.register(cors, { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST', 'PATCH', 'DELETE'] })

// PostgreSQL doit répondre avant l'enregistrement des routes : plusieurs
// features créent leur table à l'inscription (shareRoutes, pixelChat, unlocks).
// Sans cette attente, un démarrage plus rapide que la base tue le process.
try {
  await connectWithRetry()
} catch (err) {
  logger.error(err)
  process.exit(1)
}
// --- Routes REST (features) ---
await authRoutes(fastify, {
  pool, redis, jwtSecret: JWT_SECRET,
  // Appelé après une suppression de compte. io et cooldown sont initialisés
  // plus bas, mais ce rappel ne s'exécute qu'au traitement d'une requête.
  onAccountDeleted: (username) => {
    cooldown.invalidate(username)
    colorAccess.invalidate(username)
    const socketId = usernameToSocket.get(username.toLowerCase())
    if (socketId) io.sockets.sockets.get(socketId)?.disconnect(true)
  },
})
await playerRoutes(fastify, { pool })
await timelapseRoutes(fastify, { pool })
await zoneRoutes(fastify, { pool, redis, gridSize: GRID_SIZE })
await shareRoutes(fastify, { pool, redis, gridSize: GRID_SIZE })
await healthRoutes(fastify, { redis, pool })
await canvasRoutes(fastify, { redis, pool })
await analyticsRoutes(fastify, { pool, redis })

// --- Socket.io ---
const io = new Server(fastify.server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
  // 8 Mo : la grille binaire en fait 4, le reste est de la marge. La valeur
  // était à 64 Mo du temps où grid:init transportait du JSON.
  maxHttpBufferSize: 8e6,
})

// Vérifie le JWT du handshake — les viewers sans token restent acceptés en lecture seule
io.use(createSocketAuth({ jwtSecret: JWT_SECRET, bridgeToken: BRIDGE_TOKEN }))

// --- Joueurs connectés ---
// socketId → { username, source }
const connectedPlayers = new Map()
// username → socketId (pour les notifications ciblées)
const usernameToSocket = new Map()

function getPlayersPayload() {
  return presencePayload(connectedPlayers)
}

function broadcastPlayers() {
  io.emit('players:update', getPlayersPayload())
}

// --- Cooldown de pose de pixel ---
// Toute la logique (rôles, streak, cache, purge) vit dans features/canvas/cooldown.js
const cooldown = createCooldownController({ pool, testUsernames: TEST_USERNAMES })
// Couleurs débloquées par joueur, en cache — invalidé à chaque déblocage
const colorAccess = createColorAccess({ pool })

// --- Socket.io événements ---
io.on('connection', async (socket) => {
  logger.info(`[Socket] Connecté : ${socket.id}`)

  // Grille initiale + état des joueurs + stats.
  // Socket.io n'attend pas ce handler asynchrone : sans ce try/catch, une
  // indisponibilité de Redis produit une promesse rejetée non gérée, que Node
  // traite par défaut en terminant le process. Une panne Redis doit dégrader
  // la connexion, pas mettre l'API à terre.
  try {
    const buf = await loadGrid(redis)
    socket.emit('grid:init', {
      // Le buffer part tel quel : Socket.io le transporte en binaire. En
      // JSON, ces 4 Mo devenaient 4 194 304 entiers sérialisés, soit une
      // dizaine de mégaoctets de texte à produire, transmettre et parser à
      // chaque connexion.
      grid:    buf,
      size:    GRID_SIZE,
      colors:  COLORS,
      players: getPlayersPayload(),
      stats:   await getStats(redis),
    })
  } catch (err) {
    logger.error({ err: err.message }, 'grid:init')
    socket.emit('grid:error', { message: 'Grille temporairement indisponible' })
  }

  // Le client annonce son pseudo et sa plateforme
  // L'identité enregistrée est celle prouvée au handshake, pas celle annoncée
  socket.on('player:join', (declared = {}) => {
    // Sans identité prouvée, le socket reste compté comme visiteur du web
    registerPresence(connectedPlayers, usernameToSocket, socket.id,
      resolvePlayerIdentity(declared, socket.data))
    broadcastPlayers()
  })

  // Renvoie la grille au client qui la demande (après canvas:reload)
  socket.on('grid:request', async () => {
    try {
      const buf = await loadGrid(redis)
      socket.emit('grid:init', {
        grid:    buf,
        size:    GRID_SIZE,
        colors:  COLORS,
        players: getPlayersPayload(),
        stats:   await getStats(redis),
      })
    } catch (err) {
      logger.error({ err: err.message }, 'grid:request')
      socket.emit('grid:error', { message: 'Grille temporairement indisponible' })
    }
  })

  // Authentification admin
  socket.on('admin:auth', (password, ack) => {
    // Même protection que POST /api/admin/login : sans limite de tentatives,
    // ce canal permettrait de brute-forcer le mot de passe admin par socket.
    const ip = socket.handshake.address ?? 'unknown'
    if (!checkAuthRateLimit(`admin-socket:${ip}`, 5)) {
      return ack?.({ error: 'Trop de tentatives, réessayez dans 1 minute' })
    }
    const expected = process.env.ADMIN_PASSWORD
    if (!expected || !constantTimeEqual(password, expected)) {
      logger.warn(`[Admin] Tentative échouée depuis ${socket.id}`)
      return ack?.({ error: 'Mot de passe incorrect' })
    }
    socket.data.isAdmin = true
    logger.info(`[Admin] Accès accordé à ${socket.id}`)
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
      logger.info(`[Admin] Pixel (${x},${y}) remis à blanc`)
      ack?.({ ok: true })
    } catch (err) {
      logger.error({ err: err }, 'admin:clear')
      ack?.({ error: 'Erreur serveur' })
    }
  })

  // Remise à zéro complète (admin)
  socket.on('admin:clearAll', async (_, ack) => {
    if (!socket.data.isAdmin) return ack?.({ error: 'Non autorisé' })
    try {
      const total = await clearGrid(redis)
      // Un seul signal : les clients redemandent la grille d'eux-mêmes
      io.emit('canvas:reload')
      logger.info('[Admin] Canvas entièrement remis à zéro')
      ack?.({ ok: true, cleared: total })
    } catch (err) {
      logger.error({ err: err }, 'admin:clearAll')
      ack?.({ error: 'Erreur serveur' })
    }
  })

  // Placement de pixel — la règle métier vit dans features/canvas/place-pixel.js,
  // ce handler ne s'occupe que de diffuser les conséquences.
  socket.on('pixel:place', async (data, ack) => {
    try {
      const result = await placePixel(
        { redis, pool, cooldown, colorAccess },
        data,
        { verifiedUsername: socket.data.verifiedUsername, isBridge: socket.data.isBridge === true },
      )

      if (!result.ok) {
        return ack?.({
          error: result.error,
          ...(result.code     && { code: result.code }),
          ...(result.cooldown && { cooldown: result.cooldown }),
        })
      }

      const { pixel, prevMeta, cooldownMs } = result
      io.emit('pixel:update', pixel)
      io.emit('stats:update', await getStats(redis))

      const ownerChanged = changedOwner(prevMeta, pixel)

      // Le fil de discussion appartenait au propriétaire précédent
      if (ownerChanged) {
        resetPixelThread(io, pool, pixel.x, pixel.y)
          .catch(err => logger.error({ err: err.message }, 'pixel:chat:reset'))
      }

      // Progression du joueur — hors du chemin critique
      processPixelPlaced(pool, pixel.username, pixel.colorId, pixel.x, pixel.y)
        .then(() => checkFeatureUnlocks(pool, pixel.username))
        .then(newUnlocks => {
          if (newUnlocks.length === 0) return
          const socketId = usernameToSocket.get(pixel.username.toLowerCase())
          if (socketId) io.to(socketId).emit('unlocks:new', { unlocks: newUnlocks })
        })
        .catch(err => logger.error({ err: err.message }, 'unlocks'))

      if (ownerChanged) {
        processPixelLost(pool, prevMeta.username).catch(() => {})
        processPixelOverwritten(pool, pixel.username).catch(() => {})
        cooldown.invalidate(pixel.username)

        // Prévient le joueur écrasé, s'il est connecté
        const targetSocketId = usernameToSocket.get(prevMeta.username.toLowerCase())
        if (targetSocketId) {
          io.to(targetSocketId).emit('pixel:overwritten', {
            x: pixel.x, y: pixel.y, colorId: pixel.colorId,
            by: pixel.username, source: pixel.source,
          })
        }
      }

      const { role, streak } = await cooldown.getUser(pixel.username)
      ack?.({ ok: true, role, streak_hours: streak, cooldown: cooldownMs })
    } catch (err) {
      logger.error({ err: err }, 'pixel:place')
      ack?.({ error: 'Erreur serveur' })
    }
  })

  // Chat global / zone
  registerChatEvents(io, socket, connectedPlayers)
  // Chat par pixel
  registerPixelChatEvents(io, socket, connectedPlayers, pool, usernameToSocket)

  socket.on('disconnect', () => {
    logger.info(`[Socket] Déconnecté : ${socket.id}`)
    unregisterPresence(connectedPlayers, usernameToSocket, socket.id)
    broadcastPlayers()
  })
})

await adminRoutes(fastify, {
  pool, io, usernameToSocket, JWT_SECRET, redis, setPixel, GRID_SIZE,
  onRoleChanged: (username) => {
    cooldown.invalidate(username)
    colorAccess.invalidate(username)
  },
})
await unlockRoutes(fastify, { pool, JWT_SECRET, colorAccess })
await reportRoutes(fastify, { pool, JWT_SECRET })
await profileRoutes(fastify, { pool })
await globalDashboardRoutes(fastify, { pool })
await playerDashboardRoutes(fastify, { pool, gridSize: GRID_SIZE })

// Filet de dernier recours. Node termine le process sur une promesse rejetée
// non gérée : pour un serveur temps réel, cela déconnecte tous les joueurs et
// leur fait recharger 4 Mo de grille à cause d'une seule requête ratée. On
// journalise bruyamment — ces rejets restent des bugs à corriger — sans couper
// le service.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason instanceof Error ? reason.stack : reason }, 'unhandledRejection')
})

// --- Démarrage ---
try {
  await initPixelChatTable(pool)
  await initUnlockTables(pool)
  // Avant l'écoute : aucun joueur existant ne doit voir une couleur refusée
  // entre le démarrage et l'attribution de ses couleurs déjà posées.
  await runUnlockMigrations(pool)
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
  logger.info(`[Fastify] Serveur démarré sur http://0.0.0.0:${PORT}`)
  if (!BRIDGE_TOKEN) {
    logger.warn('BRIDGE_TOKEN absent : les ponts de jeu ne peuvent pas s\'authentifier, les poses venues de Minecraft seront refusées')
  }
  if (TEST_USERNAMES.size > 0) {
    logger.info(`[Rate limit] Comptes exemptés : ${[...TEST_USERNAMES].join(', ')}`)
  }
} catch (err) {
  logger.error(err)
  process.exit(1)
}
