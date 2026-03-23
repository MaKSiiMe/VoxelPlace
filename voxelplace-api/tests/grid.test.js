import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getPixelIndex, GRID_SIZE } from '../src/grid.js'

describe('GRID_SIZE', () => {
  test('vaut 64', () => {
    assert.equal(GRID_SIZE, 64)
  })

  test('la grille contient 4096 pixels (64×64)', () => {
    assert.equal(GRID_SIZE * GRID_SIZE, 4096)
  })
})

describe('getPixelIndex', () => {
  test('coin haut-gauche (0,0) = index 0', () => {
    assert.equal(getPixelIndex(0, 0), 0)
  })

  test('coin haut-droit (63,0) = index 63', () => {
    assert.equal(getPixelIndex(63, 0), 63)
  })

  test('début de la 2e ligne (0,1) = index 64', () => {
    assert.equal(getPixelIndex(0, 1), GRID_SIZE)
  })

  test('milieu de la 2e ligne (5,1) = index 69', () => {
    assert.equal(getPixelIndex(5, 1), GRID_SIZE + 5)
  })

  test('coin bas-droit (63,63) = dernier index (4095)', () => {
    assert.equal(getPixelIndex(63, 63), GRID_SIZE * GRID_SIZE - 1)
  })

  test('formule : y * GRID_SIZE + x', () => {
    assert.equal(getPixelIndex(10, 20), 20 * GRID_SIZE + 10)
    assert.equal(getPixelIndex(0, 0), 0 * GRID_SIZE + 0)
    assert.equal(getPixelIndex(7, 3), 3 * GRID_SIZE + 7)
  })
})
