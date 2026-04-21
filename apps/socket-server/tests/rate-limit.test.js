import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { checkRateLimit, _resetAttempts } from '../src/features/auth/rate-limit.js'

describe('checkRateLimit', () => {
  beforeEach(() => _resetAttempts())

  it('autorise les 10 premières tentatives', () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(checkRateLimit('127.0.0.1'), true)
    }
  })

  it('bloque la 11e tentative', () => {
    for (let i = 0; i < 10; i++) checkRateLimit('127.0.0.1')
    assert.equal(checkRateLimit('127.0.0.1'), false)
  })

  it('suit chaque IP indépendamment', () => {
    for (let i = 0; i < 10; i++) checkRateLimit('1.2.3.4')
    assert.equal(checkRateLimit('1.2.3.4'), false)
    assert.equal(checkRateLimit('5.6.7.8'), true)
  })

  it('_resetAttempts vide l\'historique — une IP bloquée est libérée', () => {
    for (let i = 0; i < 10; i++) checkRateLimit('will-reset')
    assert.equal(checkRateLimit('will-reset'), false)
    _resetAttempts()
    assert.equal(checkRateLimit('will-reset'), true)
  })

  it('respecte le paramètre max personnalisé', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('custom', 3)
    assert.equal(checkRateLimit('custom', 3), false)
  })

  it('autorise exactement max tentatives, bloque la suivante', () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(checkRateLimit('exact', 5), true)
    }
    assert.equal(checkRateLimit('exact', 5), false)
    assert.equal(checkRateLimit('exact', 5), false)
  })
})
