import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock localStorage avant tout import
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear:      () => { store = {} },
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

import { useAuthStore } from '../features/auth/store'

function makeJwt(payload: Record<string, unknown>): string {
  const body = btoa(JSON.stringify(payload))
  return `header.${body}.sig`
}

const TOKEN_KEY    = 'voxelplace:token'
const USERNAME_KEY = 'voxelplace:username'

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ username: '', token: null, role: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAuthStore — login', () => {
  test('met à jour username, token et role', () => {
    const token = makeJwt({ role: 'user', exp: Date.now() / 1000 + 3600 })
    useAuthStore.getState().login({ token, username: 'alice', role: 'user' })
    const s = useAuthStore.getState()
    expect(s.username).toBe('alice')
    expect(s.token).toBe(token)
    expect(s.role).toBe('user')
  })

  test('persiste dans localStorage', () => {
    const token = makeJwt({ role: 'admin' })
    useAuthStore.getState().login({ token, username: 'bob', role: 'admin' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token)
    expect(localStorage.getItem(USERNAME_KEY)).toBe('bob')
  })
})

describe('useAuthStore — logout', () => {
  test('vide le store', () => {
    const token = makeJwt({ role: 'user' })
    useAuthStore.getState().login({ token, username: 'alice', role: 'user' })
    useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s.token).toBeNull()
    expect(s.role).toBeNull()
  })

  test('supprime les clés localStorage', () => {
    localStorage.setItem(TOKEN_KEY,    'sometoken')
    localStorage.setItem(USERNAME_KEY, 'alice')
    useAuthStore.getState().logout()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(USERNAME_KEY)).toBeNull()
  })
})

describe('useAuthStore — loadFromStorage', () => {
  test('charge un token valide depuis localStorage', () => {
    const token = makeJwt({ role: 'superuser', exp: Date.now() / 1000 + 3600 })
    localStorage.setItem(TOKEN_KEY,    token)
    localStorage.setItem(USERNAME_KEY, 'alice')
    useAuthStore.getState().loadFromStorage()
    const s = useAuthStore.getState()
    expect(s.username).toBe('alice')
    expect(s.token).toBe(token)
    expect(s.role).toBe('superuser')
  })

  test('supprime le token expiré et réinitialise le store', () => {
    const expired = makeJwt({ role: 'user', exp: Math.floor(Date.now() / 1000) - 3600 })
    localStorage.setItem(TOKEN_KEY,    expired)
    localStorage.setItem(USERNAME_KEY, 'alice')
    useAuthStore.getState().loadFromStorage()
    const s = useAuthStore.getState()
    expect(s.token).toBeNull()
    expect(s.username).toBe('')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  test('ne plante pas si localStorage est vide', () => {
    expect(() => useAuthStore.getState().loadFromStorage()).not.toThrow()
    expect(useAuthStore.getState().token).toBeNull()
  })
})
