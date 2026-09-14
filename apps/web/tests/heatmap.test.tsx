// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@features/realtime/socket', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))

import { decodeCounts } from '../features/heatmap/api'
import { heatRGBA, heatOverlayTransform } from '../features/heatmap/render'
import { useHeatmapStore } from '../features/heatmap/store'
import { HeatmapToggle, HeatmapPanel } from '../features/heatmap/components/HeatmapPanel'
import { useCanvasStore } from '../features/canvas/store'
import { useUnlocksStore } from '../features/unlocks/store'
import { useHudStore } from '../features/hud/store'
import type { TreeNode } from '../features/unlocks/api'

const b64 = (values: number[]) => {
  const bytes = new Uint8Array(values.length * 2)
  const view = new DataView(bytes.buffer)
  values.forEach((v, i) => view.setUint16(i * 2, v, true))
  return btoa(String.fromCharCode(...bytes))
}

let respond: (url: string) => { status: number; body: unknown }
const fetchMock = vi.fn(async (url: string) => {
  const { status, body } = respond(url)
  return { ok: status < 400, status, json: async () => body } as Response
})
const heatBody = (total = 3) => ({ status: 200, body: { cell: 8, size: 2, since: '24h', max: 2, total, counts: b64([0, 1, 2, 0]) } })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  respond = () => heatBody()
  useHeatmapStore.setState({ enabled: false, period: '24h', status: 'idle', data: null })
  useCanvasStore.setState({ role: 'user' })
  useUnlocksStore.setState({ tree: [], colors: null, streak: null, status: 'idle' })
  useHudStore.setState({ panel: null, focusNode: null, lockedHint: null })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const heatNode = (unlocked: boolean): TreeNode => ({
  nodeId: 'feature:heatmap', type: 'feature', level: null, colorId: null, name: 'Heatmap',
  streakCost: 0, comingSoon: false, conditions: [], unlocked,
})

describe('rendu', () => {
  test('decodeCounts lit des entiers 16 bits petit-boutistes', () => {
    expect([...decodeCounts(b64([0, 1, 258, 65535]))]).toEqual([0, 1, 258, 65535])
  })

  test('une case vide reste transparente ; l\'intensité croît avec le nombre de poses', () => {
    const rgba = heatRGBA(Uint16Array.from([0, 1, 10, 100]), 100)
    const alpha = [3, 7, 11, 15].map((i) => rgba[i])
    expect(alpha[0]).toBe(0)
    expect(alpha[1]).toBeGreaterThan(0)
    expect(alpha[2]).toBeGreaterThan(alpha[1])
    expect(alpha[3]).toBeGreaterThan(alpha[2])
    expect(alpha[3]).toBeLessThan(255)   // la toile reste lisible sous la case la plus chaude
  })

  test('sans poses, rien n\'est dessiné', () => {
    expect(heatRGBA(Uint16Array.from([0, 0]), 0).every((b) => b === 0)).toBe(true)
  })

  test('le calque reprend la transformation de la grille, signe de l\'axe Y compris', () => {
    // La grille est affichée avec une échelle Y négative : un calque qui la
    // perdrait placerait la chaleur en miroir vertical des poses.
    expect(heatOverlayTransform({ x: 100, y: 900, scaleX: 4, scaleY: -4 }, 8)).toEqual({ x: 100, y: 900, scaleX: 32, scaleY: -32 })
  })
})

describe('useHeatmapStore', () => {
  test('charge la période choisie à l\'activation', async () => {
    await act(async () => { useHeatmapStore.getState().setEnabled(true) })
    await waitFor(() => expect(useHeatmapStore.getState().status).toBe('ready'))
    expect(fetchMock.mock.calls[0][0]).toContain('/api/heatmap?since=24h')
    expect([...useHeatmapStore.getState().data!.counts]).toEqual([0, 1, 2, 0])
  })

  test('« Tout » n\'envoie pas de période', async () => {
    useHeatmapStore.setState({ enabled: true })
    await act(async () => { useHeatmapStore.getState().setPeriod('all') })
    await waitFor(() => expect(useHeatmapStore.getState().status).toBe('ready'))
    expect(fetchMock.mock.calls.at(-1)![0]).toMatch(/\/api\/heatmap$/)
  })

  test('un refus du serveur passe en « verrouillée »', async () => {
    respond = () => ({ status: 403, body: { error: 'x' } })
    await act(async () => { useHeatmapStore.getState().setEnabled(true) })
    await waitFor(() => expect(useHeatmapStore.getState().status).toBe('locked'))
  })

  test('ignore la réponse d\'une période abandonnée', async () => {
    let releaseSlow!: () => void
    respond = (url) => url.includes('since=24h') ? heatBody(999) : heatBody(7)
    // Réponse déjà en route au moment de l'annulation : elle arrive quand même
    fetchMock.mockImplementationOnce((url: string) => new Promise((resolve) => {
      releaseSlow = () => resolve({ ok: true, status: 200, json: async () => respond(url).body } as Response)
    }))
    act(() => { useHeatmapStore.getState().setEnabled(true) })
    await act(async () => { useHeatmapStore.getState().setPeriod('7d') })
    await waitFor(() => expect(useHeatmapStore.getState().data?.total).toBe(7))
    releaseSlow()
    await new Promise((r) => setTimeout(r, 0))
    expect(useHeatmapStore.getState().data?.total).toBe(7)
  })

  test('désactiver efface les données', async () => {
    await act(async () => { useHeatmapStore.getState().setEnabled(true) })
    await waitFor(() => expect(useHeatmapStore.getState().data).not.toBeNull())
    act(() => { useHeatmapStore.getState().setEnabled(false) })
    expect(useHeatmapStore.getState()).toMatchObject({ status: 'idle', data: null })
  })
})

describe('<HeatmapToggle />', () => {
  test('absent pour un visiteur', () => {
    useCanvasStore.setState({ role: null })
    const { container } = render(<HeatmapToggle />)
    expect(container.innerHTML).toBe('')
  })

  test('à débloquer : ouvre la progression sur la heatmap', async () => {
    useUnlocksStore.setState({ tree: [heatNode(false)] })
    render(<HeatmapToggle />)
    await userEvent.click(screen.getByRole('button', { name: 'Heatmap — à débloquer' }))
    expect(useHudStore.getState()).toMatchObject({ panel: 'unlocks', focusNode: 'feature:heatmap' })
    expect(useHeatmapStore.getState().enabled).toBe(false)
  })

  test('débloquée : affiche et masque le calque', async () => {
    useUnlocksStore.setState({ tree: [heatNode(true)] })
    render(<HeatmapToggle />)
    await userEvent.click(screen.getByRole('button', { name: 'Afficher la heatmap' }))
    expect(useHeatmapStore.getState().enabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Masquer la heatmap' }).getAttribute('aria-pressed')).toBe('true')
  })

  test('ouverte d\'office à l\'équipe, comme sur le serveur', () => {
    useCanvasStore.setState({ role: 'admin' })
    useUnlocksStore.setState({ tree: [heatNode(false)] })
    render(<HeatmapToggle />)
    expect(screen.getByRole('button', { name: 'Afficher la heatmap' })).toBeTruthy()
  })
})

describe('<HeatmapPanel />', () => {
  test('résume la période et change de période', async () => {
    useHeatmapStore.setState({ enabled: true })
    await act(async () => { void useHeatmapStore.getState().load() })
    render(<HeatmapPanel />)
    expect((await screen.findByRole('status')).textContent).toBe('3 poses les dernières 24 heures.')
    await userEvent.click(screen.getByRole('button', { name: '7 j' }))
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)![0]).toContain('since=7d'))
    expect(screen.getByRole('button', { name: '7 j' }).getAttribute('aria-pressed')).toBe('true')
  })

  test('propose de réessayer après une erreur', async () => {
    respond = () => ({ status: 500, body: {} })
    useHeatmapStore.setState({ enabled: true })
    await act(async () => { await useHeatmapStore.getState().load() })
    render(<HeatmapPanel />)
    respond = () => heatBody()
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(useHeatmapStore.getState().status).toBe('ready'))
  })
})
