// ── Feature : Pixel Chat ──────────────────────────────────────────────────────
// Chaque pixel a son propre thread de conversation, lié à la vie du pixel courant.
// Quand un nouveau pixel est posé en (x,y), la conversation précédente est archivée
// et une nouvelle conversation vide commence.
//
// Événements client → serveur :
//   pixel:chat:join    { x, y }           → rejoindre le thread d'un pixel
//   pixel:chat:send    { x, y, message }  → envoyer un message dans le thread
//
// Événements serveur → client :
//   pixel:chat:history { x, y, owner, messages[], placed_at }
//   pixel:chat:message { x, y, username, message, timestamp }
//   pixel:chat:reset   { x, y }           → le pixel a été écrasé, thread réinitialisé

const MAX_MESSAGE_LENGTH = 300
const RATE_LIMIT_MS      = 1500
const lastMessageAt      = new Map()   // username → timestamp

function sanitize(str) {
  return str.trim().slice(0, MAX_MESSAGE_LENGTH)
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Garde la fonction pour compatibilité avec l'appel dans index.js,
// mais les tables sont désormais créées par init.sql au démarrage du conteneur.
export async function initPixelChatTable(_pool) {}

export function registerPixelChatEvents(io, socket, connectedPlayers, pool, usernameToSocket) {

  // Rejoindre le thread d'un pixel + recevoir l'historique
  socket.on('pixel:chat:join', async ({ x, y } = {}) => {
    if (typeof x !== 'number' || typeof y !== 'number') return

    const room = `pixel:${x}:${y}`

    // Quitte les threads précédents (un seul à la fois)
    for (const r of socket.rooms) {
      if (r.startsWith('pixel:') && r !== socket.id) socket.leave(r)
    }
    socket.join(room)

    // Récupère le propriétaire actuel du pixel
    const pixelResult = await pool.query(`
      SELECT username, placed_at
      FROM pixel_history
      WHERE x = $1 AND y = $2
      ORDER BY placed_at DESC
      LIMIT 1
    `, [x, y])

    if (pixelResult.rows.length === 0) {
      return socket.emit('pixel:chat:history', { x, y, owner: null, messages: [] })
    }

    const { username: owner, placed_at } = pixelResult.rows[0]

    // Récupère les messages du thread courant
    const msgResult = await pool.query(`
      SELECT username, message, created_at
      FROM pixel_messages
      WHERE x = $1 AND y = $2
      ORDER BY created_at ASC
      LIMIT 100
    `, [x, y])

    socket.emit('pixel:chat:history', {
      x, y,
      owner,
      placed_at,
      messages: msgResult.rows,
    })
  })

  // Envoyer un message dans le thread d'un pixel
  socket.on('pixel:chat:send', async ({ x, y, message } = {}) => {
    if (typeof x !== 'number' || typeof y !== 'number') return
    if (typeof message !== 'string' || !message.trim()) return

    const player = connectedPlayers.get(socket.id)
    const username = player?.username ?? null

    // Anti-spam (par username si connecté, par socket sinon)
    const spamKey = username ?? socket.id
    const now  = Date.now()
    const last = lastMessageAt.get(spamKey) ?? 0
    if (now - last < RATE_LIMIT_MS) return
    lastMessageAt.set(spamKey, now)

    // Récupère le pixel courant
    const pixelResult = await pool.query(`
      SELECT username AS owner, placed_at
      FROM pixel_history
      WHERE x = $1 AND y = $2
      ORDER BY placed_at DESC
      LIMIT 1
    `, [x, y])

    if (pixelResult.rows.length === 0) return

    const { owner, placed_at } = pixelResult.rows[0]

    const clean = sanitize(message)

    // Persiste le message
    await pool.query(`
      INSERT INTO pixel_messages (x, y, username, message)
      VALUES ($1, $2, $3, $4)
    `, [x, y, username, clean])

    const msg = {
      x, y,
      username,
      message:   clean,
      timestamp: new Date().toISOString(),
    }

    const room = `pixel:${x}:${y}`

    // Rejoint la room si pas encore dedans (devient participant du thread)
    socket.join(room)

    // Broadcast à tous les participants du thread
    io.to(room).emit('pixel:chat:message', msg)

    // Notifie le propriétaire du pixel s'il est connecté et n'est pas déjà dans la room
    if (owner && owner !== username) {
      const ownerSocketId = usernameToSocket.get(owner.toLowerCase())
      if (ownerSocketId) {
        const ownerSocket = io.sockets.sockets.get(ownerSocketId)
        if (ownerSocket && !ownerSocket.rooms.has(room)) {
          ownerSocket.emit('pixel:chat:notification', { x, y, from: username, message: clean })
        }
      }
    }
  })
}

// Appelé depuis index.js lors d'un pixel:place pour réinitialiser le thread
export async function resetPixelThread(io, pool, x, y) {
  io.to(`pixel:${x}:${y}`).emit('pixel:chat:reset', { x, y })
  await pool.query('DELETE FROM pixel_messages WHERE x = $1 AND y = $2', [x, y])
}
