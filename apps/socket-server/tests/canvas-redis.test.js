// Tests d'intégration de la couche canvas contre le Redis de test.
// Valide en même temps le vrai code (grid.js) et la fidélité du FakeRedis :
// un mock dont la sémantique dérive rendrait tous les autres tests trompeurs.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { FakeRedis } from './helpers/redis-fake.js'
import { loadGrid, setPixel, clearGrid, getPixelMeta, getPixelIndex, GRID_SIZE } from '../src/features/canvas/grid.js'

let redis
beforeEach(() => { redis = new FakeRedis() })

describe('loadGrid', () => {
  it('crée une grille vide de GRID_SIZE² octets au premier appel', async () => {
    const grid = await loadGrid(redis)
    assert.equal(grid.length, GRID_SIZE * GRID_SIZE)
    assert.ok(grid.every(b => b === 0))
  })

  it('persiste la grille : deux appels renvoient le même contenu', async () => {
    await loadGrid(redis)
    await setPixel(redis, { x: 10, y: 20, colorId: 7, username: 'Alice', source: 'web' })
    const grid = await loadGrid(redis)
    assert.equal(grid[getPixelIndex(10, 20)], 7)
  })

  it('reconstruit la grille depuis les métadonnées si le buffer a une taille invalide', async () => {
    // Simule une corruption : buffer tronqué, métadonnées intactes
    await redis.hset('voxelplace:pixels', '3,4', JSON.stringify({ x: 3, y: 4, colorId: 9 }))
    await redis.set('voxelplace:grid', Buffer.alloc(128, 0))

    const grid = await loadGrid(redis)
    assert.equal(grid.length, GRID_SIZE * GRID_SIZE)
    assert.equal(grid[getPixelIndex(3, 4)], 9, 'le pixel doit être restauré depuis les métadonnées')
  })

  it('ignore les métadonnées corrompues sans échouer', async () => {
    await redis.hset('voxelplace:pixels', 'bad', 'ceci n est pas du JSON')
    await redis.hset('voxelplace:pixels', '1,1', JSON.stringify({ x: 1, y: 1, colorId: 5 }))
    await redis.set('voxelplace:grid', Buffer.alloc(16, 0))

    const grid = await loadGrid(redis)
    assert.equal(grid[getPixelIndex(1, 1)], 5)
  })
})

describe('setPixel', () => {
  it("n'écrit qu'un seul octet, sans toucher aux voisins", async () => {
    await loadGrid(redis)
    await setPixel(redis, { x: 100, y: 100, colorId: 12, username: 'Bob', source: 'web' })

    const grid = await loadGrid(redis)
    const i = getPixelIndex(100, 100)
    assert.equal(grid[i],     12)
    assert.equal(grid[i - 1],  0, 'le pixel précédent doit rester intact')
    assert.equal(grid[i + 1],  0, 'le pixel suivant doit rester intact')
  })

  it('enregistre les métadonnées du pixel', async () => {
    await loadGrid(redis)
    await setPixel(redis, { x: 5, y: 6, colorId: 3, username: 'Alice', source: 'minecraft' })

    const meta = await getPixelMeta(redis, 5, 6)
    assert.equal(meta.username, 'Alice')
    assert.equal(meta.source,   'minecraft')
    assert.equal(meta.colorId,  3)
    assert.ok(typeof meta.updatedAt === 'number')
  })

  it('écrase le pixel et ses métadonnées lors du repassage', async () => {
    await loadGrid(redis)
    await setPixel(redis, { x: 1, y: 1, colorId: 5, username: 'Alice', source: 'web' })
    await setPixel(redis, { x: 1, y: 1, colorId: 9, username: 'Bob',   source: 'web' })

    const grid = await loadGrid(redis)
    assert.equal(grid[getPixelIndex(1, 1)], 9)
    assert.equal((await getPixelMeta(redis, 1, 1)).username, 'Bob')
  })

  it('gère le tout dernier pixel de la grille', async () => {
    await loadGrid(redis)
    const last = GRID_SIZE - 1
    await setPixel(redis, { x: last, y: last, colorId: 15, username: 'Edge', source: 'web' })

    const grid = await loadGrid(redis)
    assert.equal(grid[getPixelIndex(last, last)], 15)
    assert.equal(grid.length, GRID_SIZE * GRID_SIZE, 'la grille ne doit pas avoir grandi')
  })

  it('renvoie null pour un pixel jamais posé', async () => {
    assert.equal(await getPixelMeta(redis, 42, 42), null)
  })
})

describe('clearGrid', () => {
  it('remet tous les pixels à blanc et supprime les métadonnées', async () => {
    await loadGrid(redis)
    await setPixel(redis, { x: 1, y: 1, colorId: 5, username: 'Alice', source: 'web' })
    await setPixel(redis, { x: 2, y: 2, colorId: 8, username: 'Bob',   source: 'web' })

    const cleared = await clearGrid(redis)
    assert.equal(cleared, GRID_SIZE * GRID_SIZE)

    const grid = await loadGrid(redis)
    assert.ok(grid.every(b => b === 0), 'aucun pixel ne doit subsister')
    assert.equal(await getPixelMeta(redis, 1, 1), null)
  })

  it('conserve une grille de la bonne taille (pas de reconstruction parasite)', async () => {
    await loadGrid(redis)
    await clearGrid(redis)
    const grid = await loadGrid(redis)
    assert.equal(grid.length, GRID_SIZE * GRID_SIZE)
  })
})

describe('résilience', () => {
  it('propage l\'erreur quand Redis est indisponible', async () => {
    redis.setFailing(true)
    await assert.rejects(() => loadGrid(redis), /indisponible/)
  })
})
