import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword, signToken, verifyToken } from '../src/features/auth/routes.js'

describe('hashPassword', () => {
  it('génère un hash différent du mot de passe original', async () => {
    const hash = await hashPassword('test123')
    assert.notEqual(hash, 'test123')
  })

  it('le hash commence par $2 (format bcrypt)', async () => {
    const hash = await hashPassword('secret')
    assert.ok(hash.startsWith('$2'), `hash inattendu : ${hash}`)
  })

  it('deux appels sur le même mot de passe donnent des hashs différents (salt)', async () => {
    const h1 = await hashPassword('same')
    const h2 = await hashPassword('same')
    assert.notEqual(h1, h2)
  })
})

describe('verifyPassword', () => {
  it('accepte le bon mot de passe', async () => {
    const hash = await hashPassword('correct')
    assert.equal(await verifyPassword('correct', hash), true)
  })

  it('rejette un mauvais mot de passe', async () => {
    const hash = await hashPassword('correct')
    assert.equal(await verifyPassword('wrong', hash), false)
  })

  it('rejette une chaîne vide', async () => {
    const hash = await hashPassword('correct')
    assert.equal(await verifyPassword('', hash), false)
  })
})

describe('signToken / verifyToken', () => {
  const secret = 'test_secret_rncp'

  it('génère un token JWT en 3 parties (header.payload.signature)', () => {
    const token = signToken({ id: 1, username: 'alice' }, secret)
    assert.equal(typeof token, 'string')
    assert.equal(token.split('.').length, 3)
  })

  it('vérifie un token valide et retourne le payload', () => {
    const token = signToken({ id: 42, username: 'bob' }, secret)
    const payload = verifyToken(token, secret)
    assert.equal(payload.id, 42)
    assert.equal(payload.username, 'bob')
  })

  it('retourne null pour un token invalide', () => {
    assert.equal(verifyToken('invalid.token.here', secret), null)
  })

  it('retourne null si signé avec un secret différent', () => {
    const token = signToken({ id: 1, username: 'alice' }, 'secret_a')
    assert.equal(verifyToken(token, 'secret_b'), null)
  })
})
