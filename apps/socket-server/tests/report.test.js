import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateReport } from '../src/features/report/routes.js'

describe('validateReport — signaler un pixel', () => {
  it('accepte un signalement pixel valide', () => {
    const result = validateReport({ target_type: 'pixel', x: 100, y: 200 })
    assert.ok(result)
    assert.equal(result.target_type, 'pixel')
    assert.equal(result.x, 100)
    assert.equal(result.y, 200)
  })

  it('rejette un pixel sans coordonnées', () => {
    assert.equal(validateReport({ target_type: 'pixel' }), null)
    assert.equal(validateReport({ target_type: 'pixel', x: 10 }), null)
    assert.equal(validateReport({ target_type: 'pixel', y: 10 }), null)
  })

  it('rejette un pixel avec des coordonnées non-numériques', () => {
    assert.equal(validateReport({ target_type: 'pixel', x: '10', y: 20 }), null)
    assert.equal(validateReport({ target_type: 'pixel', x: 10, y: null }), null)
  })
})

describe('validateReport — signaler un joueur', () => {
  it('accepte un signalement joueur valide', () => {
    const result = validateReport({ target_type: 'player', target_username: 'griefer' })
    assert.ok(result)
    assert.equal(result.target_type, 'player')
    assert.equal(result.target_username, 'griefer')
  })

  it('rejette un signalement joueur sans username', () => {
    assert.equal(validateReport({ target_type: 'player' }), null)
    assert.equal(validateReport({ target_type: 'player', target_username: '' }), null)
  })
})

describe('validateReport — target_type invalide', () => {
  it('rejette un target_type inconnu', () => {
    assert.equal(validateReport({ target_type: 'unknown' }), null)
    assert.equal(validateReport({ target_type: '' }), null)
    assert.equal(validateReport({ target_type: null }), null)
  })

  it('rejette un corps vide ou undefined', () => {
    assert.equal(validateReport({}), null)
    assert.equal(validateReport(undefined), null)
  })
})

describe('validateReport — champs optionnels', () => {
  it('reason est optionnel et mis à null par défaut', () => {
    const result = validateReport({ target_type: 'player', target_username: 'alice' })
    assert.equal(result.reason, null)
  })

  it('reason est conservée si fournie', () => {
    const result = validateReport({ target_type: 'player', target_username: 'alice', reason: 'spam' })
    assert.equal(result.reason, 'spam')
  })

  it('target_username est null pour un signalement pixel', () => {
    const result = validateReport({ target_type: 'pixel', x: 0, y: 0 })
    assert.equal(result.target_username, null)
  })
})
