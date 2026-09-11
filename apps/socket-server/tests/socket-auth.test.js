// Test d'intégration : monte un vrai serveur Socket.io avec le middleware
// d'authentification et s'y connecte avec un vrai client.
//
// Régressions couvertes :
//   · verifyToken appelé sans être importé : Socket.io n'entourant pas ses
//     middlewares d'un try/catch, le ReferenceError tuait le process.
//   · le pont Minecraft était reconnu sur la seule déclaration du client ; il
//     doit désormais prouver un secret partagé au handshake.

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { io as createClient } from 'socket.io-client'
import { createSocketAuth } from '../src/features/auth/socket-auth.js'
import { signToken } from '../src/features/auth/routes.js'

const JWT_SECRET   = 'test_secret'
const BRIDGE_TOKEN = 'secret_du_pont_minecraft'

/** Démarre un serveur avec la configuration donnée. */
async function startServer(options) {
  const httpServer = createServer()
  const ioServer   = new Server(httpServer)
  const sockets    = new Map()   // socket.id → socket.data
  ioServer.use(createSocketAuth(options))
  ioServer.on('connection', (socket) => sockets.set(socket.id, socket.data))
  await new Promise((resolve) => httpServer.listen(0, resolve))
  return {
    port: httpServer.address().port,
    sockets,
    close: async () => { await ioServer.close(); httpServer.close() },
  }
}

/** Se connecte avec le handshake donné ; résout avec socket.data côté serveur. */
function connect(server, auth) {
  return new Promise((resolve, reject) => {
    const client = createClient(`http://localhost:${server.port}`, { auth, transports: ['websocket'] })
    const timer  = setTimeout(() => { client.close(); reject(new Error('timeout — connexion jamais établie')) }, 5000)
    client.on('connect', () => {
      clearTimeout(timer)
      const data = server.sockets.get(client.id)
      client.close()
      resolve(data)
    })
    client.on('connect_error', (err) => { clearTimeout(timer); client.close(); reject(err) })
  })
}

describe('createSocketAuth — joueurs web', () => {
  let server
  before(async () => { server = await startServer({ jwtSecret: JWT_SECRET, bridgeToken: BRIDGE_TOKEN }) })
  after(async () => { await server.close() })

  it('accepte une connexion authentifiée et attache le username vérifié', async () => {
    const token = signToken({ id: 1, username: 'Alice', role: 'user' }, JWT_SECRET)
    const data  = await connect(server, { token })
    assert.equal(data.verifiedUsername, 'Alice')
    assert.equal(data.verifiedRole,     'user')
  })

  it('accepte un visiteur sans token, sans identité (lecture seule)', async () => {
    const data = await connect(server, { token: '' })
    assert.equal(data.verifiedUsername, undefined)
    assert.equal(data.isBridge,         undefined)
  })

  it('accepte un token invalide sans le vérifier — et sans tuer le serveur', async () => {
    const data = await connect(server, { token: 'pas.un.jwt' })
    assert.equal(data.verifiedUsername, undefined)
  })

  it('rejette un token signé avec un autre secret', async () => {
    const token = signToken({ id: 2, username: 'Mallory', role: 'admin' }, 'mauvais_secret')
    assert.equal((await connect(server, { token })).verifiedUsername, undefined)
  })

  it('conserve le rôle transporté par le token', async () => {
    const token = signToken({ id: 3, username: 'Root', role: 'superadmin' }, JWT_SECRET)
    assert.equal((await connect(server, { token })).verifiedRole, 'superadmin')
  })
})

describe('createSocketAuth — pont de jeu', () => {
  let server
  before(async () => { server = await startServer({ jwtSecret: JWT_SECRET, bridgeToken: BRIDGE_TOKEN }) })
  after(async () => { await server.close() })

  it('reconnaît le pont qui présente le bon secret', async () => {
    assert.equal((await connect(server, { bridgeToken: BRIDGE_TOKEN })).isBridge, true)
  })

  it('refuse un secret erroné', async () => {
    assert.equal((await connect(server, { bridgeToken: 'devine' })).isBridge, undefined)
  })

  it('refuse un secret de même longueur mais différent', async () => {
    const forged = 'x'.repeat(BRIDGE_TOKEN.length)
    assert.equal((await connect(server, { bridgeToken: forged })).isBridge, undefined)
  })

  it('ne confère pas le statut de pont à un jeton de joueur, même administrateur', async () => {
    const token = signToken({ id: 9, username: 'Admin', role: 'superadmin' }, JWT_SECRET)
    assert.equal((await connect(server, { token })).isBridge, undefined)
  })
})

describe('createSocketAuth — sans secret de pont configuré', () => {
  let server
  before(async () => { server = await startServer({ jwtSecret: JWT_SECRET }) })
  after(async () => { await server.close() })

  it('ne reconnaît aucun pont, quel que soit le secret présenté', async () => {
    // Un secret vide ou absent côté serveur ne doit jamais valider un secret
    // vide ou absent côté client.
    assert.equal((await connect(server, { bridgeToken: '' })).isBridge,        undefined)
    assert.equal((await connect(server, { bridgeToken: 'nimporte' })).isBridge, undefined)
  })
})
