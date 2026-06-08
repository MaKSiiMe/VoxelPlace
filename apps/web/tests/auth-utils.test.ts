import { describe, test, expect } from 'vitest'
import { getRoleFromToken, isTokenExpired } from '../features/auth/utils'

// JWT factice : header.payload.signature (non vérifié côté client)
function makeJwt(payload: Record<string, unknown>): string {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body    = btoa(JSON.stringify(payload))
  return `${header}.${body}.fakesig`
}

describe('getRoleFromToken', () => {
  test('retourne null pour un token null', () => {
    expect(getRoleFromToken(null)).toBeNull()
  })

  test('retourne null pour un token malformé', () => {
    expect(getRoleFromToken('pas.un.jwt')).toBeNull()
  })

  test('retourne le role du payload', () => {
    const token = makeJwt({ role: 'admin', username: 'alice' })
    expect(getRoleFromToken(token)).toBe('admin')
  })

  test('retourne null si le payload n\'a pas de role', () => {
    const token = makeJwt({ username: 'alice' })
    expect(getRoleFromToken(token)).toBeNull()
  })

  test('retourne null si role n\'est pas une string', () => {
    const token = makeJwt({ role: 42 })
    expect(getRoleFromToken(token)).toBeNull()
  })
})

describe('isTokenExpired', () => {
  test('retourne true pour null', () => {
    expect(isTokenExpired(null)).toBe(true)
  })

  test('retourne true pour un token malformé', () => {
    expect(isTokenExpired('pas.un.jwt')).toBe(true)
  })

  test('retourne true pour un token expiré', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 3600 })
    expect(isTokenExpired(token)).toBe(true)
  })

  test('retourne false pour un token valide', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
    expect(isTokenExpired(token)).toBe(false)
  })

  test('retourne false si pas de champ exp (token sans expiration)', () => {
    const token = makeJwt({ username: 'alice' })
    expect(isTokenExpired(token)).toBe(false)
  })
})
