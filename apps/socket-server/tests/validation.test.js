import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isValidCoord, sanitizeUsername, validatePixel } from '../src/features/canvas/utils.js'

describe('isValidCoord', () => {
  test('accepte les bornes valides 0 et 2047', () => {
    assert.equal(isValidCoord(0), true)
    assert.equal(isValidCoord(2047), true)
    assert.equal(isValidCoord(512), true)
  })

  test('rejette les coordonnées hors-limites', () => {
    assert.equal(isValidCoord(-1), false)
    assert.equal(isValidCoord(2048), false)
    assert.equal(isValidCoord(9999), false)
  })

  test('rejette les non-entiers et non-nombres', () => {
    assert.equal(isValidCoord(1.5), false)
    assert.equal(isValidCoord('5'), false)
    assert.equal(isValidCoord(null), false)
    assert.equal(isValidCoord(undefined), false)
  })
})

describe('sanitizeUsername', () => {
  test('supprime les caractères dangereux XSS', () => {
    assert.equal(sanitizeUsername('<script>alert(1)</script>'), 'scriptalert(1)/script')
    assert.equal(sanitizeUsername('"hack"'), 'hack')
    assert.equal(sanitizeUsername("it's"), 'its')
  })

  test('tronque à 32 caractères maximum', () => {
    const result = sanitizeUsername('a'.repeat(50))
    assert.equal(result.length, 32)
  })

  test('supprime les espaces en début et fin', () => {
    assert.equal(sanitizeUsername('  alice  '), 'alice')
  })

  test('supprime les caractères de contrôle', () => {
    assert.equal(sanitizeUsername('alice\x00bob'), 'alicebob')
    assert.equal(sanitizeUsername('test\x1Fuser'), 'testuser')
  })
})

describe('validatePixel', () => {
  const valid = { x: 10, y: 20, colorId: 3, username: 'alice', source: 'web' }

  test('accepte un pixel valide', () => {
    const result = validatePixel(valid)
    assert.ok(result)
    assert.equal(result.x, 10)
    assert.equal(result.y, 20)
    assert.equal(result.colorId, 3)
    assert.equal(result.username, 'alice')
    assert.equal(result.source, 'web')
  })

  test('rejette des coordonnées X invalides', () => {
    assert.equal(validatePixel({ ...valid, x: -1 }), null)
    assert.equal(validatePixel({ ...valid, x: 2048 }), null)
    assert.equal(validatePixel({ ...valid, x: 1.5 }), null)
  })

  test('rejette des coordonnées Y invalides', () => {
    assert.equal(validatePixel({ ...valid, y: -1 }), null)
    assert.equal(validatePixel({ ...valid, y: 2048 }), null)
  })

  test('rejette un colorId hors palette (0-15)', () => {
    assert.equal(validatePixel({ ...valid, colorId: 16 }), null)
    assert.equal(validatePixel({ ...valid, colorId: -1 }), null)
    assert.equal(validatePixel({ ...valid, colorId: 1.5 }), null)
  })

  test('accepte colorId 15 (rose — dernière couleur)', () => {
    assert.ok(validatePixel({ ...valid, colorId: 15 }))
  })

  test('rejette un username vide après sanitisation', () => {
    assert.equal(validatePixel({ ...valid, username: '  ' }), null)
    assert.equal(validatePixel({ ...valid, username: '<>"' }), null)
    assert.equal(validatePixel({ ...valid, username: '' }), null)
  })

  test('rejette un username non-string', () => {
    assert.equal(validatePixel({ ...valid, username: 42 }), null)
    assert.equal(validatePixel({ ...valid, username: null }), null)
  })

  test('utilise "web" comme source par défaut', () => {
    const result = validatePixel({ ...valid, source: undefined })
    assert.equal(result?.source, 'web')
  })

  test('sanitise la source', () => {
    const result = validatePixel({ ...valid, source: '<evil>' })
    assert.ok(!result?.source.includes('<'))
  })

  test('rejette null ou undefined', () => {
    assert.equal(validatePixel(null), null)
    assert.equal(validatePixel(undefined), null)
    assert.equal(validatePixel({}), null)
  })
})
