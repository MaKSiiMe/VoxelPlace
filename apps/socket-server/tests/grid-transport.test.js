// Vérifie que la grille voyage bien en binaire sur Socket.io.
//
// Elle transitait en JSON : Array.from(buffer) produit 4 194 304 entiers, soit
// une dizaine de mégaoctets de texte à sérialiser, transmettre et parser à
// chaque connexion — pour 4 Mo de données utiles. C'est ce qui obligeait à
// monter maxHttpBufferSize à 64 Mo.

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { io as createClient } from 'socket.io-client'

let httpServer, ioServer, port

// Grille réduite : la mécanique de transport est la même, les tests restent rapides
const SIZE = 256
const grid = Buffer.alloc(SIZE * SIZE, 0)
grid[0]            = 5
grid[SIZE * 3 + 4] = 11
grid[grid.length - 1] = 15

before(async () => {
  httpServer = createServer()
  ioServer   = new Server(httpServer, { maxHttpBufferSize: 8e6 })
  ioServer.on('connection', (socket) => {
    socket.emit('grid:init', { grid, size: SIZE })
  })
  await new Promise((resolve) => httpServer.listen(0, resolve))
  port = httpServer.address().port
})

after(async () => {
  await ioServer.close()
  httpServer.close()
})

function receiveGrid() {
  return new Promise((resolve, reject) => {
    const client = createClient(`http://localhost:${port}`, { transports: ['websocket'] })
    const timer  = setTimeout(() => { client.close(); reject(new Error('timeout')) }, 5000)
    client.on('grid:init', (payload) => {
      clearTimeout(timer)
      client.close()
      resolve(payload)
    })
    client.on('connect_error', (err) => { clearTimeout(timer); client.close(); reject(err) })
  })
}

describe('transport de la grille', () => {
  it('arrive côté client sous forme binaire, pas en tableau de nombres', async () => {
    const { grid: received } = await receiveGrid()
    assert.ok(
      Buffer.isBuffer(received) || received instanceof Uint8Array || received instanceof ArrayBuffer,
      `attendu du binaire, reçu ${received?.constructor?.name}`
    )
    assert.ok(!Array.isArray(received), 'un tableau JSON signifierait un retour à l\'ancien format')
  })

  it('restitue la grille octet pour octet', async () => {
    const { grid: received } = await receiveGrid()
    const bytes = new Uint8Array(received.buffer ?? received)

    assert.equal(bytes.length, SIZE * SIZE)
    assert.equal(bytes[0],                5)
    assert.equal(bytes[SIZE * 3 + 4],    11)
    assert.equal(bytes[bytes.length - 1], 15)
  })

  it('transporte un octet par pixel — le JSON en coûtait plusieurs', async () => {
    const { grid: received } = await receiveGrid()
    const bytes = new Uint8Array(received.buffer ?? received)

    const jsonSize = JSON.stringify(Array.from(bytes)).length
    assert.equal(bytes.byteLength, SIZE * SIZE)
    assert.ok(
      jsonSize > bytes.byteLength * 2,
      `le JSON équivalent pèse ${jsonSize} octets contre ${bytes.byteLength} en binaire`
    )
  })
})
