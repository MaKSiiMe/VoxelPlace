// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@features/realtime/socket', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))

import { PixelInspector } from '../features/canvas/components/PixelInspector'
import { useCanvasStore } from '../features/canvas/store'
import { useAuthStore } from '../features/auth/store'
import { useNotifications } from '../features/notifications/store'

/** Réponses simulées, indexées par fragment d'URL. */
let routes: Record<string, () => Promise<unknown>>
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const key = Object.keys(routes).find(k => url.includes(k) && (init?.method ?? 'GET') === (k.startsWith('POST ') ? 'POST' : 'GET'))
    ?? Object.keys(routes).find(k => url.includes(k.replace(/^POST /, '')))
  if (!key) throw new Error(`route non simulée : ${url}`)
  const body = await routes[key]()
  const status = (body as { __status?: number })?.__status ?? 200
  return { ok: status < 400, status, json: async () => body } as Response
})

const ok = (body: unknown) => () => Promise.resolve(body)

const inspect = (x: number, y: number) => act(() => { useCanvasStore.getState().setInspectedPixel({ x, y }) })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  useCanvasStore.setState({ inspectedPixel: null })
  useAuthStore.setState({ username: '', token: null, role: null })
  useNotifications.getState().clear()
  routes = {
    '/api/pixel/1036/984/history': ok({ history: [
      { colorId: 5, username: 'Alice', source: 'web',       placedAt: new Date(Date.now() - 120_000).toISOString() },
      { colorId: 9, username: null,    source: 'minecraft', placedAt: new Date(Date.now() - 7_200_000).toISOString() },
    ] }),
    '/api/pixel/1036/984': ok({ x: 1036, y: 984, colorId: 5, username: 'Alice', source: 'web', updatedAt: Date.now() - 120_000 }),
  }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('<PixelInspector />', () => {
  test('ne rend rien tant qu\'aucun pixel n\'est inspecté', () => {
    const { container } = render(<PixelInspector />)
    expect(container.innerHTML).toBe('')
  })

  test('affiche coordonnées du HUD, couleur, auteur et plateforme', async () => {
    render(<PixelInspector />)
    inspect(1036, 984)
    await screen.findByText('Rouge')

    const panel = screen.getByRole('complementary')
    expect(panel.textContent).toContain('X: 12  Y: 40')
    expect(panel.textContent).toContain('Par Alice')
    expect(panel.textContent).toContain('web')
  })

  test('liste l\'historique, avec les auteurs effacés présentés comme anonymes', async () => {
    render(<PixelInspector />)
    inspect(1036, 984)
    const history = await screen.findByRole('region', { name: 'Historique du pixel' })
    expect(history.querySelectorAll('li')).toHaveLength(2)
    expect(history.textContent).toContain('un joueur anonyme')
  })

  test('indique un pixel jamais modifié, sans proposer de le signaler', async () => {
    routes = {
      '/api/pixel/5/5/history': ok({ history: [] }),
      '/api/pixel/5/5':         ok({ x: 5, y: 5, colorId: 0, username: null, source: null }),
    }
    render(<PixelInspector />)
    inspect(5, 5)
    await screen.findByText('Jamais modifié')
    expect(screen.queryByRole('button', { name: 'Signaler ce pixel' })).toBeNull()
  })

  test('signale une erreur de chargement', async () => {
    routes['/api/pixel/1036/984'] = () => Promise.reject(new Error('réseau'))
    render(<PixelInspector />)
    inspect(1036, 984)
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger')
  })

  test('n\'affiche jamais la réponse tardive d\'un pixel précédent', async () => {
    let releaseSlow!: () => void
    routes = {
      '/api/pixel/1/1/history': () => new Promise(r => { releaseSlow = () => r({ history: [] }) }),
      '/api/pixel/1/1':         ok({ x: 1, y: 1, colorId: 3, username: 'Ancien', source: 'web' }),
      '/api/pixel/2/2/history': ok({ history: [] }),
      '/api/pixel/2/2':         ok({ x: 2, y: 2, colorId: 12, username: 'Actuel', source: 'web' }),
    }
    render(<PixelInspector />)
    inspect(1, 1)
    inspect(2, 2)
    await screen.findByText('Bleu')
    await act(async () => { releaseSlow() })
    expect(screen.queryByText(/Ancien/)).toBeNull()
    expect(screen.getByRole('complementary').textContent).toContain('Actuel')
  })

  test('se ferme au bouton et à la touche Échap', async () => {
    render(<PixelInspector />)
    inspect(1036, 984)
    await screen.findByText('Rouge')
    await userEvent.click(screen.getByRole('button', { name: "Fermer l'inspecteur" }))
    expect(useCanvasStore.getState().inspectedPixel).toBeNull()

    inspect(1036, 984)
    await screen.findByText('Rouge')
    await userEvent.keyboard('{Escape}')
    expect(useCanvasStore.getState().inspectedPixel).toBeNull()
  })
})

describe('<PixelInspector /> — signalement', () => {
  async function openReport() {
    render(<PixelInspector />)
    inspect(1036, 984)
    await userEvent.click(await screen.findByRole('button', { name: 'Signaler ce pixel' }))
  }

  test('envoie le motif choisi, avec le jeton du joueur connecté', async () => {
    useAuthStore.setState({ username: 'Bob', token: 'jeton-bob', role: 'user' })
    routes['POST /api/report'] = ok({ ok: true, __status: 201 })
    await openReport()

    await userEvent.click(screen.getByRole('radio', { name: 'Spam ou vandalisme' }))
    await userEvent.click(screen.getByRole('button', { name: 'Signaler' }))

    const call = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST')!
    const init = call[1] as RequestInit & { headers: Record<string, string> }
    expect(JSON.parse(init.body as string)).toEqual({ target_type: 'pixel', x: 1036, y: 984, reason: 'Spam ou vandalisme' })
    expect(init.headers.Authorization).toBe('Bearer jeton-bob')

    await screen.findByText('Pixel signalé.')
    expect(useNotifications.getState().items[0]).toMatchObject({ kind: 'success' })
  })

  test('reste possible pour un visiteur, de façon anonyme', async () => {
    routes['POST /api/report'] = ok({ ok: true, __status: 201 })
    await openReport()
    await userEvent.click(screen.getByRole('button', { name: 'Signaler' }))
    const call = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST')!
    expect((call[1] as { headers: Record<string, string> }).headers.Authorization).toBeUndefined()
  })

  test('relaie le refus du serveur (limite de signalements)', async () => {
    routes['POST /api/report'] = ok({ error: 'Trop de signalements, réessaie dans une minute', __status: 429 })
    await openReport()
    await userEvent.click(screen.getByRole('button', { name: 'Signaler' }))
    await waitFor(() => expect(useNotifications.getState().items[0]).toMatchObject({
      kind: 'error', message: 'Trop de signalements, réessaie dans une minute',
    }))
    expect(screen.queryByText('Pixel signalé.')).toBeNull()
  })
})
