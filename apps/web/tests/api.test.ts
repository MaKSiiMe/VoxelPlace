import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { API_URL } from '../shared/api'
import { apiLogin, apiRegister } from '../features/auth/api'

describe('API_URL', () => {
  test('vaut http://localhost:3001 par défaut (sans variable d\'env)', () => {
    expect(API_URL).toBe('http://localhost:3001')
  })
})

describe('apiLogin', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  test('renvoie token, username et role en cas de succès', async () => {
    const payload = { token: 'jwt.tok.en', username: 'alice', role: 'user' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))

    const result = await apiLogin('alice', 'pass123')
    expect(result).toEqual(payload)
  })

  test('lève une erreur avec le message serveur sur 401', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Identifiants incorrects' }), { status: 401 })
    )
    await expect(apiLogin('alice', 'mauvais')).rejects.toThrow('Identifiants incorrects')
  })

  test('lève "Erreur serveur" si la réponse non-ok n\'a pas de champ error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 500 }))
    await expect(apiLogin('alice', 'pass')).rejects.toThrow('Erreur serveur')
  })

  test('appelle le bon endpoint avec la bonne méthode', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ token: 't', username: 'u', role: 'user' }), { status: 200 })
    )
    await apiLogin('alice', 'pass')
    const [url, opts] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/auth/login')
    expect(opts.method).toBe('POST')
  })
})

describe('apiRegister', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  test('renvoie les données auth après inscription', async () => {
    const payload = { token: 'jwt.tok.en', username: 'bob', role: 'user' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload), { status: 201 }))

    const result = await apiRegister('bob', 'pass123')
    expect(result).toEqual(payload)
  })

  test('lève une erreur si le pseudo est déjà pris', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Pseudo déjà utilisé' }), { status: 409 })
    )
    await expect(apiRegister('alice', 'pass')).rejects.toThrow('Pseudo déjà utilisé')
  })

  test('appelle le bon endpoint avec la bonne méthode', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ token: 't', username: 'u', role: 'user' }), { status: 201 })
    )
    await apiRegister('bob', 'pass')
    const [url, opts] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/auth/register')
    expect(opts.method).toBe('POST')
  })
})
