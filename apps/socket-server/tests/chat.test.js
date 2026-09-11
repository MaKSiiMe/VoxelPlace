// Tests du chat global et des fils de discussion par pixel.
//
// Aucun client ne consomme encore ces événements, mais ils sont joignables par
// n'importe quel socket : c'est de la surface d'attaque en production. Régressions
// couvertes : écriture anonyme persistée en base, anti-spam contourné par simple
// reconnexion, coordonnées non validées faisant échouer les requêtes SQL,
// messages échappés en HTML au stockage.

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startTestDatabase, truncateAll } from './helpers/postgres.js'
import { registerPixelChatEvents } from '../src/features/chat/pixelChat.js'
import { registerChatEvents, validateRoom } from '../src/features/chat/events.js'
import { sanitizeMessage, isValidPixelTarget, createThrottle } from '../src/features/chat/message.js'

// ── Doubles Socket.io ────────────────────────────────────────────────────────

let socketSeq = 0
function fakeSocket() {
  const handlers = {}
  return {
    id:      `sock-${++socketSeq}`,
    rooms:   new Set(),
    emitted: [],
    on(event, fn) { handlers[event] = fn },
    emit(event, payload) { this.emitted.push({ event, payload }) },
    join(room)  { this.rooms.add(room) },
    leave(room) { this.rooms.delete(room) },
    /** Déclenche un événement client et attend la fin du handler. */
    trigger: (event, payload) => handlers[event]?.(payload),
  }
}

function fakeIo(sockets = new Map()) {
  const broadcasts = []
  return {
    broadcasts,
    emit: (event, payload) => broadcasts.push({ event, payload, room: null }),
    to:   (room) => ({ emit: (event, payload) => broadcasts.push({ event, payload, room }) }),
    sockets: { sockets },
  }
}

// ── Règles pures ─────────────────────────────────────────────────────────────

describe('sanitizeMessage', () => {
  it('conserve le texte brut — l\'échappement revient au rendu', () => {
    // Pré-échappé au stockage, « a < b » s'afficherait « a &lt; b » une fois
    // rendu par React, qui échappe déjà.
    assert.equal(sanitizeMessage('a < b > c', 100), 'a < b > c')
  })

  it('retire les caractères de contrôle mais garde les sauts de ligne', () => {
    assert.equal(sanitizeMessage('bon\x00jour\x07\nligne', 100), 'bonjour\nligne')
  })

  it('tronque à la longueur maximale et supprime les espaces de bord', () => {
    assert.equal(sanitizeMessage('   abcdef   ', 3), 'abc')
  })

  it('rejette le vide, les espaces seuls et les non-chaînes', () => {
    for (const bad of ['', '   ', '\x00\x01', null, undefined, 42, {}]) {
      assert.equal(sanitizeMessage(bad, 100), null, `${JSON.stringify(bad)} doit être rejeté`)
    }
  })
})

describe('isValidPixelTarget', () => {
  it('accepte les entiers de la grille et rejette le reste', () => {
    assert.equal(isValidPixelTarget(0, 2047), true)
    for (const [x, y] of [[NaN, 0], [Infinity, 0], [1.5, 0], [-1, 0], [0, 2048], ['1', 0]]) {
      assert.equal(isValidPixelTarget(x, y), false, `(${x}, ${y}) doit être rejeté`)
    }
  })
})

describe('createThrottle', () => {
  it('autorise un message par intervalle et par clé', () => {
    let t = 0
    const th = createThrottle(1000, () => t)
    assert.equal(th.allow('alice'), true)
    assert.equal(th.allow('alice'), false)
    assert.equal(th.allow('bob'),   true, 'chaque clé a son propre créneau')
    t = 1000
    assert.equal(th.allow('alice'), true)
    th.stop()
  })
})

describe('validateRoom', () => {
  it('borne les rooms de zone à la grille', () => {
    assert.equal(validateRoom('zone:0:0'),   'zone:0:0')
    assert.equal(validateRoom('zone:31:31'), 'zone:31:31')
    assert.equal(validateRoom('zone:32:0'),  'global', 'aucun pixel n\'appartient à la zone 32')
    assert.equal(validateRoom('zone:999999:0'), 'global')
    assert.equal(validateRoom('admin'), 'global')
  })
})

// ── Fils de discussion par pixel, contre un vrai PostgreSQL ──────────────────

let db
const skip = () => db?.skipped ? 'PostgreSQL indisponible sur cette machine' : false

before(async () => { db = await startTestDatabase() })
after(async () => { await db?.cleanup() })
beforeEach(async () => {
  if (db.skipped) return
  await truncateAll(db.pool)
  await db.pool.query(
    `INSERT INTO pixel_history (x, y, color_id, username, source) VALUES (10, 20, 5, 'Alice', 'web')`
  )
})

/** Monte le chat pixel pour un socket, identifié ou non. */
function mountPixelChat(username) {
  const socket  = fakeSocket()
  const players = new Map(username ? [[socket.id, { username, source: 'web' }]] : [])
  const io      = fakeIo()
  registerPixelChatEvents(io, socket, players, db.pool, new Map())
  return { socket, io }
}

const messageCount = async () =>
  (await db.pool.query('SELECT count(*)::int AS n FROM pixel_messages')).rows[0].n

describe('pixel:chat:send', { skip: skip() }, () => {
  it('persiste et diffuse le message d\'un joueur identifié', async () => {
    const { socket, io } = mountPixelChat('Bob')
    await socket.trigger('pixel:chat:send', { x: 10, y: 20, message: 'joli pixel' })

    assert.equal(await messageCount(), 1)
    const sent = io.broadcasts.find(b => b.event === 'pixel:chat:message')
    assert.equal(sent.room, 'pixel:10:20')
    assert.equal(sent.payload.username, 'Bob')
  })

  it('refuse l\'écriture à un visiteur non identifié', async () => {
    const { socket } = mountPixelChat(null)
    await socket.trigger('pixel:chat:send', { x: 10, y: 20, message: 'spam anonyme' })
    assert.equal(await messageCount(), 0, 'aucun message anonyme ne doit être persisté')
  })

  it('limite le débit par joueur, pas par socket', async () => {
    // Indexé sur socket.id, l'anti-spam se contournait en se reconnectant.
    // Pseudo propre à ce test : l'anti-spam est partagé au niveau du module,
    // un joueur ayant écrit dans un test voisin serait déjà limité.
    const first  = mountPixelChat('Reconnecteur')
    const second = mountPixelChat('Reconnecteur')   // même joueur, nouveau socket
    await first.socket.trigger('pixel:chat:send',  { x: 10, y: 20, message: 'un' })
    await second.socket.trigger('pixel:chat:send', { x: 10, y: 20, message: 'deux' })
    assert.equal(await messageCount(), 1, 'la reconnexion ne doit pas ouvrir un nouveau créneau')
  })

  it('ignore les coordonnées invalides sans lever d\'erreur', async () => {
    const { socket } = mountPixelChat('Carl')
    for (const [x, y] of [[NaN, 20], [1.5, 20], [99999, 20]]) {
      await assert.doesNotReject(() => socket.trigger('pixel:chat:send', { x, y, message: 'test' }))
    }
    assert.equal(await messageCount(), 0)
  })

  it('n\'ouvre pas de fil sur un pixel jamais posé', async () => {
    const { socket } = mountPixelChat('Dana')
    await socket.trigger('pixel:chat:send', { x: 500, y: 500, message: 'personne ici' })
    assert.equal(await messageCount(), 0)
  })

  it('stocke le texte tel quel, sans échappement HTML', async () => {
    const { socket } = mountPixelChat('Eve')
    await socket.trigger('pixel:chat:send', { x: 10, y: 20, message: '<3 ce pixel' })
    const { rows } = await db.pool.query('SELECT message FROM pixel_messages')
    assert.equal(rows[0].message, '<3 ce pixel')
  })

  it('prévient le propriétaire connecté qui n\'est pas dans le fil', async () => {
    const owner   = fakeSocket()
    const sockets = new Map([[owner.id, owner]])
    const socket  = fakeSocket()
    const io      = fakeIo(sockets)
    registerPixelChatEvents(
      io, socket, new Map([[socket.id, { username: 'Frank', source: 'web' }]]),
      db.pool, new Map([['alice', owner.id]]),
    )
    await socket.trigger('pixel:chat:send', { x: 10, y: 20, message: 'salut Alice' })

    const notif = owner.emitted.find(e => e.event === 'pixel:chat:notification')
    assert.ok(notif, 'le propriétaire doit être notifié')
    assert.equal(notif.payload.from, 'Frank')
  })
})

describe('pixel:chat:join', { skip: skip() }, () => {
  it('renvoie le propriétaire et l\'historique du fil, visiteurs compris', async () => {
    await db.pool.query(`INSERT INTO pixel_messages (x, y, username, message) VALUES (10, 20, 'Bob', 'ancien')`)
    const { socket } = mountPixelChat(null)
    await socket.trigger('pixel:chat:join', { x: 10, y: 20 })

    const history = socket.emitted.find(e => e.event === 'pixel:chat:history')
    assert.equal(history.payload.owner, 'Alice')
    assert.equal(history.payload.messages.length, 1)
    assert.ok(socket.rooms.has('pixel:10:20'))
  })

  it('ne suit qu\'un fil à la fois', async () => {
    await db.pool.query(`INSERT INTO pixel_history (x, y, color_id, username, source) VALUES (11, 20, 1, 'Bob', 'web')`)
    const { socket } = mountPixelChat(null)
    await socket.trigger('pixel:chat:join', { x: 10, y: 20 })
    await socket.trigger('pixel:chat:join', { x: 11, y: 20 })
    assert.ok(!socket.rooms.has('pixel:10:20'))
    assert.ok(socket.rooms.has('pixel:11:20'))
  })

  it('survit à une panne de base de données', async () => {
    // Handler asynchrone que Socket.io n'attend pas : sans try/catch, l'erreur
    // devenait un rejet non géré.
    const socket = fakeSocket()
    const brokenPool = { query: async () => { throw new Error('base indisponible') } }
    registerPixelChatEvents(fakeIo(), socket, new Map(), brokenPool, new Map())
    await assert.doesNotReject(() => socket.trigger('pixel:chat:join', { x: 10, y: 20 }))
  })
})

// ── Chat global ──────────────────────────────────────────────────────────────

describe('chat global', () => {
  function mountGlobalChat(username) {
    const socket  = fakeSocket()
    const players = new Map(username ? [[socket.id, { username, source: 'web' }]] : [])
    const io      = fakeIo()
    registerChatEvents(io, socket, players)
    return { socket, io }
  }

  it('diffuse le message d\'un joueur identifié', () => {
    const { socket, io } = mountGlobalChat('Gina')
    socket.trigger('chat:send', { message: 'bonjour' })
    const msg = io.broadcasts.find(b => b.event === 'chat:message')
    assert.equal(msg.payload.username, 'Gina')
    assert.equal(msg.payload.message,  'bonjour')
  })

  it('ignore un visiteur non identifié', () => {
    const { socket, io } = mountGlobalChat(null)
    socket.trigger('chat:send', { message: 'anonyme' })
    assert.equal(io.broadcasts.length, 0)
  })

  it('rejoint la room de zone correspondant aux coordonnées', () => {
    const { socket } = mountGlobalChat('Hugo')
    socket.trigger('chat:join', { x: 130, y: 70 })
    assert.ok(socket.rooms.has('zone:2:1'))
  })

  it('ignore une position invalide au lieu de créer une room « zone:NaN:NaN »', () => {
    const { socket } = mountGlobalChat('Ines')
    socket.trigger('chat:join', { x: NaN, y: 0 })
    assert.ok(![...socket.rooms].some(r => r.includes('NaN')))
  })
})
