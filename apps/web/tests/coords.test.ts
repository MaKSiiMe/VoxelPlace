import { describe, test, expect } from 'vitest'
import { toDisplayCoords, toGridCoords, formatDisplayCoords } from '../features/canvas/coords'

describe('repère affiché au joueur', () => {
  test('le centre de la grille est l\'origine', () => {
    expect(toDisplayCoords(1024, 1024)).toEqual({ x: 0, y: 0 })
  })

  test('y croît vers le haut à l\'écran, vers le bas sur la grille', () => {
    // Sur la grille, une ligne plus haute a un y plus petit ; affiché, il est plus grand.
    expect(toDisplayCoords(1024, 1000).y).toBe(24)
    expect(toDisplayCoords(1024, 1100).y).toBe(-76)
  })

  test('les coins de la grille', () => {
    expect(toDisplayCoords(0, 0)).toEqual({ x: -1024, y: 1024 })
    expect(toDisplayCoords(2047, 2047)).toEqual({ x: 1023, y: -1023 })
  })

  test('conversion aller-retour sans perte', () => {
    for (const [gx, gy] of [[0, 0], [5, 2000], [1024, 1024], [2047, 1]]) {
      const d = toDisplayCoords(gx, gy)
      expect(toGridCoords(d.x, d.y)).toEqual({ x: gx, y: gy })
    }
  })

  test('libellé identique à celui de la notch', () => {
    expect(formatDisplayCoords(1036, 984)).toBe('X: 12  Y: 40')
  })
})
