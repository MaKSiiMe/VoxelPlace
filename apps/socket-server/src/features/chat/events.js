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

import { sanitizeMessage, isValidPixelTarget, createThrottle } from './message.js'
import { GRID_SIZE } from '../canvas/grid.js'

const MAX_MESSAGE_LENGTH = 200
const HISTORY_SIZE       = 100
const RATE_LIMIT_MS      = 1000  // 1 message par seconde par joueur

// Historique en mémoire par room
const histories = new Map()   // room → Message[]

const throttle = createThrottle(RATE_LIMIT_MS)

function getHistory(room) {
  if (!histories.has(room)) histories.set(room, [])
  return histories.get(room)
}

function pushMessage(room, msg) {
  const history = getHistory(room)
  history.push(msg)
  if (history.length > HISTORY_SIZE) history.shift()
}

export function registerChatEvents(io, socket, connectedPlayers) {

  // Envoie l'historique global au joueur qui se connecte
  socket.emit('chat:history', {
    room:     'global',
    messages: getHistory('global'),
  })

  // Réception d'un message
  socket.on('chat:send', ({ message, room } = {}) => {
    // Identité prouvée au handshake : un visiteur n'a pas d'entrée ici
    const player = connectedPlayers.get(socket.id)
    if (!player?.username) return

    const clean = sanitizeMessage(message, MAX_MESSAGE_LENGTH)
    if (!clean) return
    if (!throttle.allow(player.username.toLowerCase())) return

    // Validation de la room
    const validRoom = validateRoom(room)

    const msg = {
      username:  player.username,
      message:   clean,
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
    // NaN, Infinity ou décimaux produisaient des rooms « zone:NaN:NaN »
    if (!isValidPixelTarget(x, y)) return

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

const ZONE_SIZE      = 64
const ZONES_PER_AXIS = Math.ceil(GRID_SIZE / ZONE_SIZE)

// Convertit des coordonnées en identifiant de room de zone (64×64)
function zoneRoom(x, y) {
  return `zone:${Math.floor(x / ZONE_SIZE)}:${Math.floor(y / ZONE_SIZE)}`
}

function validateRoom(room) {
  if (!room || room === 'global') return 'global'
  // Format attendu : 'zone:X:Y'
  // Bornée à la grille : un indice de zone au-delà ne correspond à aucun pixel
  const m = /^zone:(\d+):(\d+)$/.exec(room)
  if (m && Number(m[1]) < ZONES_PER_AXIS && Number(m[2]) < ZONES_PER_AXIS) return room
  return 'global'
}

export { validateRoom, zoneRoom }
