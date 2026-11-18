import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { constantTimeEqual } from '../src/shared/crypto.js'

const source = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')

describe('constantTimeEqual', () => {
  it('reconnaît deux chaînes identiques', () => {
    assert.equal(constantTimeEqual('secret-identique', 'secret-identique'), true)
  })

  it('rejette deux chaînes de même longueur qui diffèrent', () => {
    assert.equal(constantTimeEqual('secret-identiqua', 'secret-identique'), false)
  })

  it('rejette une chaîne de longueur différente sans lever d\'exception', () => {
    // timingSafeEqual lève sur des longueurs différentes : la fonction doit l'absorber
    assert.equal(constantTimeEqual('court', 'beaucoup-plus-long'), false)
    assert.equal(constantTimeEqual('', 'secret'), false)
  })

  it('compare les octets UTF-8 et non les caractères', () => {
    // « é » fait 2 octets : même longueur en caractères, pas en octets
    assert.equal(constantTimeEqual('é', 'e'), false)
    assert.equal(constantTimeEqual('mot-de-passe-é', 'mot-de-passe-é'), true)
  })

  it('rejette toute valeur qui n\'est pas une chaîne', () => {
    for (const value of [undefined, null, 123, ['secret'], { toString: () => 'secret' }]) {
      assert.equal(constantTimeEqual(value, 'secret'), false)
      assert.equal(constantTimeEqual('secret', value), false)
    }
  })

  it('repose sur crypto.timingSafeEqual', () => {
    assert.match(source('shared/crypto.js'), /return timingSafeEqual\(bufA, bufB\)/)
  })
})

describe('mot de passe d\'administration', () => {
  // Les deux points d'entrée (REST et socket) doivent comparer à temps constant
  for (const file of ['features/admin/routes.js', 'index.js']) {
    it(`${file} compare ADMIN_PASSWORD à temps constant`, () => {
      const code = source(file)
      assert.match(code, /constantTimeEqual\(password, expected\)/)
      assert.doesNotMatch(code, /[!=]==?\s*(expected|process\.env\.ADMIN_PASSWORD)\b/)
      assert.doesNotMatch(code, /(expected|process\.env\.ADMIN_PASSWORD)\s*[!=]==?/)
    })
  }
})
