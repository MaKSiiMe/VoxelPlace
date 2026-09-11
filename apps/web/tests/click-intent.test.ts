import { describe, test, expect } from 'vitest'
import { shouldPlace, shouldInspect, CLICK_TOLERANCE_PX } from '../features/canvas/clickIntent'
import { relativeTime } from '../shared/relativeTime'

const base = { button: 0, spaceHeld: false, inBounds: true }

describe('shouldPlace', () => {
  test('pose en mode Build au clic gauche', () => {
    expect(shouldPlace({ ...base, selectedColor: 5 })).toBe(true)
  })

  test('ne pose rien en mode Exploration', () => {
    expect(shouldPlace({ ...base, selectedColor: null })).toBe(false)
  })

  test('ne pose rien quand la barre d\'espace déplace la vue', () => {
    // Commencer un déplacement à l'espace en mode Build posait un pixel au départ
    expect(shouldPlace({ ...base, spaceHeld: true, selectedColor: 5 })).toBe(false)
  })

  test('ignore le clic droit et les clics hors grille', () => {
    expect(shouldPlace({ ...base, button: 2, selectedColor: 5 })).toBe(false)
    expect(shouldPlace({ ...base, inBounds: false, selectedColor: 5 })).toBe(false)
  })
})

describe('shouldInspect', () => {
  const click = { ...base, movedPx: 0, selectedColorAtDown: null }

  test('inspecte au clic en mode Exploration', () => {
    expect(shouldInspect(click)).toBe(true)
  })

  test('tolère un léger tremblement de la souris', () => {
    expect(shouldInspect({ ...click, movedPx: CLICK_TOLERANCE_PX })).toBe(true)
  })

  test('n\'inspecte pas après un glissement', () => {
    expect(shouldInspect({ ...click, movedPx: CLICK_TOLERANCE_PX + 1 })).toBe(false)
  })

  test('n\'inspecte pas un clic qui vient de poser un pixel', () => {
    expect(shouldInspect({ ...click, selectedColorAtDown: 3 })).toBe(false)
  })

  test('n\'inspecte pas pendant un déplacement à l\'espace', () => {
    expect(shouldInspect({ ...click, spaceHeld: true })).toBe(false)
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-09-11T12:00:00Z').getTime()

  test('à l\'instant', () => {
    expect(relativeTime(now - 10_000, now)).toBe("à l'instant")
  })

  // Intl sépare nombre et unité par une espace insécable fine (U+202F) : \s la couvre
  test('minutes, heures, jours', () => {
    expect(relativeTime(now - 3 * 60_000, now)).toMatch(/3\smin/)
    expect(relativeTime(now - 2 * 3600_000, now)).toMatch(/2\sh/)
    expect(relativeTime(now - 3 * 86400_000, now)).toMatch(/3\sj/)
  })

  test('accepte une date ISO et ignore une date invalide', () => {
    expect(relativeTime('2026-09-11T11:00:00Z', now)).toMatch(/1\sh/)
    expect(relativeTime('pas une date', now)).toBe('')
  })
})
