import { describe, test, expect } from 'vitest'
import { getRoleFromToken } from '../features/auth/utils'

// Construit un JWT factice (header + payload + signature bidon) sans clé secrète.
// Suffisant pour tester le parsing côté client (pas la vérification cryptographique).
function makeJWT(payload: object): string {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body    = btoa(JSON.stringify(payload))
  return `${header}.${body}.fakesignature`
}

describe('getRoleFromToken', () => {
  test('renvoie null pour un token null', () => {
    expect(getRoleFromToken(null)).toBeNull()
  })

  test('renvoie null pour une chaîne vide', () => {
    expect(getRoleFromToken('')).toBeNull()
  })

  test('renvoie null pour un token mal formé (pas de point)', () => {
    expect(getRoleFromToken('invalid')).toBeNull()
  })

  test('renvoie null si le payload n\'est pas du base64 valide', () => {
    expect(getRoleFromToken('header.!!!.signature')).toBeNull()
  })

  test('extrait le rôle "user"', () => {
    const token = makeJWT({ id: 1, username: 'alice', role: 'user' })
    expect(getRoleFromToken(token)).toBe('user')
  })

  test('extrait le rôle "admin"', () => {
    const token = makeJWT({ id: 2, username: 'modAdmin', role: 'admin' })
    expect(getRoleFromToken(token)).toBe('admin')
  })

  test('extrait le rôle "superadmin"', () => {
    const token = makeJWT({ role: 'superadmin' })
    expect(getRoleFromToken(token)).toBe('superadmin')
  })

  test('extrait le rôle "superuser"', () => {
    const token = makeJWT({ role: 'superuser' })
    expect(getRoleFromToken(token)).toBe('superuser')
  })

  test('renvoie null si le payload n\'a pas de champ role', () => {
    const token = makeJWT({ id: 1, username: 'alice' })
    expect(getRoleFromToken(token)).toBeNull()
  })

  test('renvoie null si role n\'est pas une string (ex: nombre)', () => {
    const token = makeJWT({ role: 42 })
    expect(getRoleFromToken(token)).toBeNull()
  })

  test('renvoie null si role est null dans le payload', () => {
    const token = makeJWT({ role: null })
    expect(getRoleFromToken(token)).toBeNull()
  })
})
