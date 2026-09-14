// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@features/realtime/socket', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))

import { timelapseUrl } from '../features/timelapse/api'
import { TimelapseDialog } from '../features/timelapse/components/TimelapseDialog'
import { useCanvasStore } from '../features/canvas/store'
import { useAuthStore } from '../features/auth/store'
import { useUnlocksStore } from '../features/unlocks/store'
import { useHudStore } from '../features/hud/store'
import type { TreeNode } from '../features/unlocks/api'

const node = (nodeId: string, unlocked: boolean): TreeNode => ({
  nodeId, type: 'feature', level: null, colorId: null, name: nodeId, streakCost: 0, comingSoon: false, unlocked,
  conditions: [{ type: 'days_played', min: 2, met: false, current: 1, target: 2 }],
})

let respond: (url: string) => { status: number }
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  const { status } = respond(url)
  const body = String(url).includes('/api/unlocks/tree')
    ? { tree: [node('feature:timelapse_personal', false), node('feature:timelapse_global', false)], colors: [0, 3, 5, 7, 12], streak_hours: 0 }
    : {}
  return { ok: status < 400, status, blob: async () => new Blob(['GIF89a'], { type: 'image/gif' }), json: async () => body } as Response
})
const createObjectURL = vi.fn(() => 'blob:apercu')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear(); createObjectURL.mockClear(); revokeObjectURL.mockClear()
  Object.assign(URL, { createObjectURL, revokeObjectURL })
  respond = () => ({ status: 200 })
  localStorage.setItem('voxelplace:token', 'jeton')
  useAuthStore.setState({ username: 'Alice' })
  useCanvasStore.setState({ role: 'user' })
  useUnlocksStore.setState({ tree: [node('feature:timelapse_personal', true), node('feature:timelapse_global', false)], streak: 0, colors: null, status: 'ready' })
  useHudStore.setState({ panel: 'timelapse', focusNode: null })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('timelapseUrl vise la bonne route et la période', () => {
  expect(timelapseUrl('me', '7d', 'Al ice')).toMatch(/\/api\/players\/Al%20ice\/gif\?since=7d$/)
  expect(timelapseUrl('canvas', 'all', 'Alice')).toMatch(/\/api\/timelapse\/gif$/)
})

describe('<TimelapseDialog />', () => {
  test('génère le timelapse personnel, l\'affiche et propose de le télécharger', async () => {
    render(<TimelapseDialog open onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Générer le timelapse' }))

    const img = await screen.findByRole('img', { name: 'Timelapse animé de tes pixels' })
    expect(img.getAttribute('src')).toBe('blob:apercu')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/players/Alice/gif?since=7d')
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer jeton' })
    expect(screen.getByRole('link', { name: 'Télécharger le GIF' }).getAttribute('download')).toBe('voxelplace-Alice-7d.gif')
  })

  test('changer un réglage retire l\'aperçu et libère sa mémoire', async () => {
    render(<TimelapseDialog open onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Générer le timelapse' }))
    await screen.findByRole('img')
    await userEvent.click(screen.getByRole('button', { name: '24 h' }))
    expect(screen.queryByRole('img')).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:apercu')
  })

  test('un timelapse verrouillé montre ses conditions au lieu du bouton', async () => {
    render(<TimelapseDialog open onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Toute la toile' }))
    expect(screen.queryByRole('button', { name: 'Générer le timelapse' })).toBeNull()
    expect(screen.getByRole('region', { name: 'À débloquer' }).textContent).toContain('Jouer 2 jours différents')
    await userEvent.click(screen.getByRole('button', { name: 'Voir la progression' }))
    expect(useHudStore.getState()).toMatchObject({ panel: 'unlocks', focusNode: 'feature:timelapse_global' })
  })

  test('l\'équipe accède à la toile entière sans l\'avoir débloquée', () => {
    useCanvasStore.setState({ role: 'admin' })
    render(<TimelapseDialog open onClose={() => {}} />)
    return userEvent.click(screen.getByRole('button', { name: 'Toute la toile' })).then(() => {
      expect(screen.getByRole('button', { name: 'Générer le timelapse' })).toBeTruthy()
    })
  })

  test.each([
    [503, 'Un autre timelapse est en cours de génération'],
    [404, 'Aucun pixel sur cette période.'],
    [429, 'réessaie dans une minute'],
  ])('explique un refus %i', async (status, message) => {
    respond = () => ({ status })
    render(<TimelapseDialog open onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Générer le timelapse' }))
    expect((await screen.findByRole('alert')).textContent).toContain(message)
  })

  test('un refus 403 resynchronise la progression', async () => {
    respond = (url) => ({ status: url.includes('/api/unlocks/tree') ? 200 : 403 })
    render(<TimelapseDialog open onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Générer le timelapse' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/unlocks/tree'))).toBe(true))
    // Arbre rechargé : le nœud n'est plus débloqué, la fenêtre montre ses conditions
    expect(await screen.findByRole('region', { name: 'À débloquer' })).toBeTruthy()
  })
})
