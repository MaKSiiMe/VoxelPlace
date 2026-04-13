import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getPixelIndex, GRID_SIZE } from '../src/features/canvas/grid.js'

describe('GRID_SIZE', () => {
  test('vaut 2048', () => {
    assert.equal(GRID_SIZE, 2048)
  })

  test('la grille contient 4 194 304 pixels (2048×2048)', () => {
    assert.equal(GRID_SIZE * GRID_SIZE, 4_194_304)
  })
})

describe('getPixelIndex', () => {
  test('coin haut-gauche (0,0) = index 0', () => {
    assert.equal(getPixelIndex(0, 0), 0)
  })

  test('coin haut-droit (2047,0) = index 2047', () => {
    assert.equal(getPixelIndex(2047, 0), 2047)
  })

  test('début de la 2e ligne (0,1) = index 2048', () => {
    assert.equal(getPixelIndex(0, 1), GRID_SIZE)
  })

  test('milieu de la 2e ligne (5,1) = index 2053', () => {
    assert.equal(getPixelIndex(5, 1), GRID_SIZE + 5)
  })

  test('coin bas-droit (2047,2047) = dernier index (4194303)', () => {
    assert.equal(getPixelIndex(2047, 2047), GRID_SIZE * GRID_SIZE - 1)
  })

  test('formule : y * GRID_SIZE + x', () => {
    assert.equal(getPixelIndex(10, 20), 20 * GRID_SIZE + 10)
    assert.equal(getPixelIndex(0, 0), 0 * GRID_SIZE + 0)
    assert.equal(getPixelIndex(7, 3), 3 * GRID_SIZE + 7)
  })
})
