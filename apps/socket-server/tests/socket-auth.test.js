// Test d'intégration : monte un vrai serveur Socket.io avec le middleware
// d'authentification et s'y connecte avec un vrai client.
//
// Régression couverte : verifyToken était appelé dans le middleware sans être
// importé. Socket.io n'entoure pas les middlewares d'un try/catch, donc le
// ReferenceError tuait le process à la première connexion authentifiée.

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { io as createClient } from 'socket.io-client'
import { createSocketAuth } from '../src/features/auth/socket-auth.js'
import { signToken } from '../src/features/auth/routes.js'

const SECRET = 'test_secret'

let httpServer, ioServer, port
// socket.id → socket.data, renseigné à la connexion pour inspection depuis les tests
const serverSockets = new Map()

before(async () => {
  httpServer = createServer()
  ioServer   = new Server(httpServer)
  ioServer.use(createSocketAuth(SECRET))
  ioServer.on('connection', (socket) => serverSockets.set(socket.id, socket.data))
  await new Promise((resolve) => httpServer.listen(0, resolve))
  port = httpServer.address().port
})

after(async () => {
  await ioServer.close()
  httpServer.close()
})

/**
 * Se connecte avec le token fourni.
 * Résout avec socket.data côté serveur, rejette si la connexion échoue.
 */
function connect(token) {
  return new Promise((resolve, reject) => {
    const client = createClient(`http://localhost:${port}`, {
      auth:       { token },
      transports: ['websocket'],
    })
    const timer = setTimeout(() => {
      client.close()
      reject(new Error('timeout — connexion jamais établie'))
    }, 5000)

    client.on('connect', () => {
      clearTimeout(timer)
      const data = serverSockets.get(client.id)
      client.close()
      resolve(data)
    })
    client.on('connect_error', (err) => {
      clearTimeout(timer)
      client.close()
      reject(err)
    })
  })
}

describe('createSocketAuth', () => {
  it('accepte une connexion authentifiée et attache le username vérifié', async () => {
    const token = signToken({ id: 1, username: 'Alice', role: 'user' }, SECRET)
    const data  = await connect(token)
    assert.equal(data.verifiedUsername, 'Alice')
    assert.equal(data.verifiedRole,     'user')
  })

  it('accepte un visiteur sans token, sans username vérifié (lecture seule)', async () => {
    const data = await connect('')
    assert.equal(data.verifiedUsername, undefined)
  })

  it('accepte un token invalide sans le vérifier — et sans tuer le serveur', async () => {
    const data = await connect('pas.un.jwt')
    assert.equal(data.verifiedUsername, undefined)
  })

  it('rejette un token signé avec un autre secret', async () => {
    const token = signToken({ id: 2, username: 'Mallory', role: 'admin' }, 'mauvais_secret')
    const data  = await connect(token)
    assert.equal(data.verifiedUsername, undefined)
  })

  it('conserve le rôle transporté par le token', async () => {
    const token = signToken({ id: 3, username: 'Root', role: 'superadmin' }, SECRET)
    const data  = await connect(token)
    assert.equal(data.verifiedRole, 'superadmin')
  })
})
