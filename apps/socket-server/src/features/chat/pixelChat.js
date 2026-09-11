// ── Feature : Pixel Chat ──────────────────────────────────────────────────────
// Chaque pixel a son propre fil de discussion, lié à la vie du pixel courant.
// Quand un nouveau propriétaire pose en (x,y), le fil précédent est effacé.
//
// Événements client → serveur :
//   pixel:chat:join    { x, y }           → rejoindre le fil d'un pixel
//   pixel:chat:send    { x, y, message }  → écrire dans le fil (compte requis)
//
// Événements serveur → client :
//   pixel:chat:history      { x, y, owner, messages[], placed_at }
//   pixel:chat:message      { x, y, username, message, timestamp }
//   pixel:chat:reset        { x, y }  → le pixel a changé de propriétaire
//   pixel:chat:notification { x, y, from, message }  → au propriétaire absent du fil

import { sanitizeMessage, isValidPixelTarget, createThrottle } from './message.js'
import { logger } from '../../shared/logger.js'

const MAX_MESSAGE_LENGTH = 300
const RATE_LIMIT_MS      = 1500
const throttle           = createThrottle(RATE_LIMIT_MS)

// Conservée pour l'appel au démarrage : les tables sont créées par init.sql.
export async function initPixelChatTable(_pool) {}

export function registerPixelChatEvents(io, socket, connectedPlayers, pool, usernameToSocket) {

  // Lecture du fil : ouverte à tous, visiteurs compris
  socket.on('pixel:chat:join', async ({ x, y } = {}) => {
    // Socket.io n'attend pas les handlers asynchrones : une erreur non
    // rattrapée ici deviendrait un rejet non géré.
    try {
      if (!isValidPixelTarget(x, y)) return

      const room = `pixel:${x}:${y}`
      for (const r of socket.rooms) {
        if (r.startsWith('pixel:') && r !== socket.id) socket.leave(r)
      }
      socket.join(room)

      const pixelResult = await pool.query(`
        SELECT username, placed_at FROM pixel_history
        WHERE x = $1 AND y = $2 ORDER BY placed_at DESC LIMIT 1
      `, [x, y])

      if (pixelResult.rows.length === 0) {
        return socket.emit('pixel:chat:history', { x, y, owner: null, messages: [] })
      }

      const { username: owner, placed_at } = pixelResult.rows[0]
      const msgResult = await pool.query(`
        SELECT username, message, created_at FROM pixel_messages
        WHERE x = $1 AND y = $2 ORDER BY created_at ASC LIMIT 100
      `, [x, y])

      socket.emit('pixel:chat:history', { x, y, owner, placed_at, messages: msgResult.rows })
    } catch (err) {
      logger.error({ err: err.message }, 'pixel:chat:join')
    }
  })

  // Écriture dans le fil : réservée aux joueurs identifiés
  socket.on('pixel:chat:send', async ({ x, y, message } = {}) => {
    try {
      if (!isValidPixelTarget(x, y)) return

      // Les visiteurs pouvaient écrire, sous un pseudo nul, avec un anti-spam
      // indexé sur l'identifiant du socket — qu'une reconnexion renouvelle.
      // Chaque message étant persisté, c'était une écriture en base illimitée
      // et anonyme. L'identité vient désormais du handshake (player-identity).
      const username = connectedPlayers.get(socket.id)?.username
      if (!username) return

      const clean = sanitizeMessage(message, MAX_MESSAGE_LENGTH)
      if (!clean) return
      if (!throttle.allow(username.toLowerCase())) return

      const pixelResult = await pool.query(`
        SELECT username AS owner FROM pixel_history
        WHERE x = $1 AND y = $2 ORDER BY placed_at DESC LIMIT 1
      `, [x, y])
      if (pixelResult.rows.length === 0) return   // pas de fil sur un pixel vierge

      const { owner } = pixelResult.rows[0]

      await pool.query(
        'INSERT INTO pixel_messages (x, y, username, message) VALUES ($1, $2, $3, $4)',
        [x, y, username, clean]
      )

      const room = `pixel:${x}:${y}`
      const msg  = { x, y, username, message: clean, timestamp: new Date().toISOString() }

      socket.join(room)
      io.to(room).emit('pixel:chat:message', msg)

      // Prévient le propriétaire du pixel s'il est connecté mais absent du fil
      if (owner && owner.toLowerCase() !== username.toLowerCase()) {
        const ownerSocket = io.sockets.sockets.get(usernameToSocket.get(owner.toLowerCase()))
        if (ownerSocket && !ownerSocket.rooms.has(room)) {
          ownerSocket.emit('pixel:chat:notification', { x, y, from: username, message: clean })
        }
      }
    } catch (err) {
      logger.error({ err: err.message }, 'pixel:chat:send')
    }
  })
}

// Appelé lors d'un changement de propriétaire du pixel
export async function resetPixelThread(io, pool, x, y) {
  io.to(`pixel:${x}:${y}`).emit('pixel:chat:reset', { x, y })
  await pool.query('DELETE FROM pixel_messages WHERE x = $1 AND y = $2', [x, y])
}
