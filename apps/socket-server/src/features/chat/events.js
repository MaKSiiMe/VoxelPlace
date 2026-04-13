// ── Feature : Chat ────────────────────────────────────────────────────────────
// Événements Socket.io :
//   chat:send    → client envoie un message  { message, room? }
//   chat:message → serveur broadcast          { username, message, room, timestamp }
//   chat:history → serveur envoie l'historique récent au nouveau connecté
//
// Rooms :
//   'global'       → chat global (tous les joueurs)
//   'zone:X:Y'     → chat de zone (zone 64×64 à laquelle appartient x,y)
//
// Persistance : 100 derniers messages en mémoire (pas de DB — ephémère)

const MAX_MESSAGE_LENGTH = 200
const HISTORY_SIZE       = 100
const RATE_LIMIT_MS      = 1000  // 1 message par seconde par joueur

// Historique en mémoire par room
const histories = new Map()   // room → Message[]

// Anti-spam : dernière émission par username
const lastMessageAt = new Map()  // username → timestamp

function getHistory(room) {
  if (!histories.has(room)) histories.set(room, [])
  return histories.get(room)
}

function pushMessage(room, msg) {
  const history = getHistory(room)
  history.push(msg)
  if (history.length > HISTORY_SIZE) history.shift()
}

function sanitize(str) {
  return str
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function registerChatEvents(io, socket, connectedPlayers) {

  // Envoie l'historique global au joueur qui se connecte
  socket.emit('chat:history', {
    room:     'global',
    messages: getHistory('global'),
  })

  // Réception d'un message
  socket.on('chat:send', ({ message, room } = {}) => {
    const player = connectedPlayers.get(socket.id)
    if (!player?.username) return

    // Validation du message
    if (typeof message !== 'string' || !message.trim()) return

    // Anti-spam
    const now  = Date.now()
    const last = lastMessageAt.get(player.username) ?? 0
    if (now - last < RATE_LIMIT_MS) return
    lastMessageAt.set(player.username, now)

    // Validation de la room
    const validRoom = validateRoom(room)

    const msg = {
      username:  player.username,
      message:   sanitize(message),
      room:      validRoom,
      timestamp: new Date().toISOString(),
    }

    pushMessage(validRoom, msg)

    if (validRoom === 'global') {
      io.emit('chat:message', msg)
    } else {
      // Rejoint la room si pas encore dedans
      socket.join(validRoom)
      io.to(validRoom).emit('chat:message', msg)
    }
  })

  // Rejoindre / quitter une room de zone
  // Le client envoie sa position pour recevoir le chat de la zone courante
  socket.on('chat:join', ({ x, y } = {}) => {
    if (typeof x !== 'number' || typeof y !== 'number') return

    // Quitte toutes les rooms de zone précédentes
    for (const room of socket.rooms) {
      if (room.startsWith('zone:')) socket.leave(room)
    }

    const room = zoneRoom(x, y)
    socket.join(room)

    socket.emit('chat:history', {
      room,
      messages: getHistory(room),
    })
  })
}

// Convertit des coordonnées en identifiant de room de zone (64×64)
function zoneRoom(x, y) {
  return `zone:${Math.floor(x / 64)}:${Math.floor(y / 64)}`
}

function validateRoom(room) {
  if (!room || room === 'global') return 'global'
  // Format attendu : 'zone:X:Y'
  if (/^zone:\d+:\d+$/.test(room)) return room
  return 'global'
}
