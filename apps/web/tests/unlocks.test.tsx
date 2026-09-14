// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act, waitFor, fireEvent, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@features/realtime/socket', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))

import { socket } from '@features/realtime/socket'
import { lockedColorsFrom, describeCondition, nodeStatus } from '../features/unlocks/progress'
import { useUnlocksStore } from '../features/unlocks/store'
import type { TreeNode, TreeResponse } from '../features/unlocks/api'
import { PaletteDock } from '../features/hud/components/PaletteDock'
import { useEscapeReturnsToExploration } from '../features/hud/components/Hud'
import { UnlockPanel, groupFeatures } from '../features/unlocks/components/UnlockPanel'
import { useHudStore } from '../features/hud/store'
import { useCanvasStore } from '../features/canvas/store'

const BASE = [0, 3, 5, 7, 12]

const color = (colorId: number, over: Partial<TreeNode> = {}): TreeNode => ({
  nodeId: `color:${colorId}`, type: 'color', level: BASE.includes(colorId) ? 1 : 2, colorId,
  name: `Couleur ${colorId}`, streakCost: BASE.includes(colorId) ? 0 : 2, comingSoon: false,
  conditions: BASE.includes(colorId) ? [] : [{ type: 'pixels_placed', min: 999, met: false, current: 0, target: 999 }],
  unlocked: BASE.includes(colorId), ...over,
})

/** Orange : 10 rouges faits, 3 jaunes sur 10. */
const orangeLocked = color(6, {
  name: 'Orange',
  conditions: [
    { type: 'color_count', colorId: 5, min: 10, met: true,  current: 12, target: 10 },
    { type: 'color_count', colorId: 7, min: 10, met: false, current: 3,  target: 10 },
  ],
})
const orangeReady = color(6, {
  name: 'Orange',
  conditions: [
    { type: 'color_count', colorId: 5, min: 10, met: true, current: 10, target: 10 },
    { type: 'color_count', colorId: 7, min: 10, met: true, current: 10, target: 10 },
  ],
})
const heatmap: TreeNode = {
  nodeId: 'feature:heatmap', type: 'feature', level: null, colorId: null, name: 'Heatmap',
  streakCost: 0, comingSoon: true, conditions: [{ type: 'pixels_lost', min: 50, met: false, current: 4, target: 50 }], unlocked: false,
}

function treeWith(orange: TreeNode, streak = 3): TreeResponse {
  return {
    tree:   [...[...Array(16).keys()].filter((id) => id !== 6).map((id) => color(id)), orange, heatmap],
    colors: BASE,
    streak_hours: streak,
  }
}

let treeResponse: TreeResponse
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (init?.method === 'POST') {
    treeResponse = { ...treeResponse, colors: [...treeResponse.colors, 6].sort((a, b) => a - b),
      tree: treeResponse.tree.map((n) => n.nodeId === 'color:6' ? { ...n, unlocked: true } : n) }
    return { ok: true, status: 201, json: async () => ({ ok: true }) } as Response
  }
  if (url.includes('/api/unlocks/tree')) return { ok: true, status: 200, json: async () => treeResponse } as Response
  throw new Error(`route non simulée : ${url}`)
})

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  vi.mocked(socket.emit).mockClear()
  treeResponse = treeWith(orangeLocked)
  useUnlocksStore.setState({ status: 'idle', tree: [], colors: null, streak: null })
  useHudStore.setState({ panel: null, lockedHint: null, focusNode: null })
  useCanvasStore.setState({ role: 'user', isEditMode: true, selectedColor: null, grid: new Uint8Array(2048 * 2048), gridSize: 2048 })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const loadTree = () => act(() => useUnlocksStore.getState().load())

// ── Fonctions pures ──────────────────────────────────────────────────────────

describe('lockedColorsFrom', () => {
  test('verrouille les 11 couleurs hors palette de base', () => {
    const locked = lockedColorsFrom(BASE)
    expect(locked.size).toBe(11)
    expect(locked.has(6)).toBe(true)
    expect(locked.has(5)).toBe(false)
  })

  test('ne verrouille rien tant que les couleurs sont inconnues', () => {
    expect(lockedColorsFrom(null).size).toBe(0)
  })
})

describe('describeCondition', () => {
  test('nomme les couleurs au lieu de leur numéro', () => {
    expect(describeCondition({ type: 'color_count', colorId: 5, min: 10 }, [])).toEqual({ label: 'Poser 10 pixels en rouge', colorId: 5 })
    expect(describeCondition({ type: 'color_unlocked', colorId: 13 }, []).label).toBe('Débloquer le violet')
  })

  test('accorde le singulier et nomme les fonctionnalités requises', () => {
    expect(describeCondition({ type: 'pixels_lost', min: 1 }, []).label).toBe('Te faire recouvrir 1 pixel')
    expect(describeCondition({ type: 'feature_unlocked', nodeId: 'feature:heatmap' }, [heatmap]).label).toBe('Débloquer « Heatmap »')
  })
})

describe('nodeStatus', () => {
  test('distingue débloqué, à venir, verrouillé, streak manquant et prêt', () => {
    expect(nodeStatus(color(5), 0)).toBe('unlocked')
    expect(nodeStatus(heatmap, 99)).toBe('coming_soon')
    expect(nodeStatus(orangeLocked, 99)).toBe('locked')
    expect(nodeStatus(orangeReady, 1)).toBe('needs_streak')
    expect(nodeStatus(orangeReady, 2)).toBe('ready')
  })

  test('ne tient rien pour rempli sans progression (visiteur)', () => {
    const anonymous = color(6, { conditions: [{ type: 'color_count', colorId: 5, min: 10 }] })
    expect(nodeStatus(anonymous, null)).toBe('locked')
  })
})

test('groupFeatures range une fonctionnalité inconnue dans « Autres » plutôt que de la perdre', () => {
  const nouvelle = { ...heatmap, nodeId: 'feature:nouvelle', name: 'Nouvelle' }
  const groups = groupFeatures([heatmap, nouvelle])
  expect(groups.map((g) => g.title)).toEqual(['Analyse', 'Autres'])
})

// ── Store ────────────────────────────────────────────────────────────────────

describe('useUnlocksStore', () => {
  test('charge arbre, couleurs et streak', async () => {
    await loadTree()
    const s = useUnlocksStore.getState()
    expect(s.status).toBe('ready')
    expect(s.colors).toEqual(BASE)
    expect(s.streak).toBe(3)
  })

  test('ignore une réponse arrivée après un chargement plus récent', async () => {
    let releaseSlow!: () => void
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
      releaseSlow = () => resolve({ ok: true, status: 200, json: async () => ({ ...treeResponse, colors: [0] }) } as Response)
    }))
    const slow = useUnlocksStore.getState().load()
    await useUnlocksStore.getState().load()
    releaseSlow()
    await slow
    expect(useUnlocksStore.getState().colors).toEqual(BASE)
  })

  test('laisse la palette ouverte si la progression ne charge pas', async () => {
    fetchMock.mockRejectedValueOnce(new Error('réseau'))
    await loadTree()
    expect(useUnlocksStore.getState().status).toBe('error')
    expect(lockedColorsFrom(useUnlocksStore.getState().colors).size).toBe(0)
  })
})

// ── Palette ──────────────────────────────────────────────────────────────────

/** Alimente la palette depuis le store, comme le fait Hud. */
function PaletteFromStore() {
  const colors = useUnlocksStore((s) => s.colors)
  return <PaletteDock onOpenAuth={() => {}} lockedColors={lockedColorsFrom(colors)} />
}
const renderPalette = () => render(<PaletteFromStore />)

describe('<PaletteDock /> — couleurs verrouillées', () => {
  test('une couleur verrouillée ne se sélectionne pas : elle explique comment la débloquer', async () => {
    await loadTree()
    renderPalette()
    await userEvent.click(screen.getByRole('button', { name: /Orange, verrouillée/ }))

    expect(useCanvasStore.getState().selectedColor).toBeNull()
    const hint = screen.getByRole('region', { name: 'Débloquer le orange' })
    expect(hint.textContent).toContain('Poser 10 pixels en jaune')
    expect(hint.textContent).toContain('3/10')
    expect(hint.textContent).toContain('Dépenser 2 h de streak')
    expect(screen.queryByRole('button', { name: /Débloquer · 2 h/ })).toBeNull()
  })

  test('une couleur prête se débloque depuis la palette et devient l\'outil actif', async () => {
    treeResponse = treeWith(orangeReady)
    await loadTree()
    renderPalette()
    await userEvent.click(screen.getByRole('button', { name: /Orange, verrouillée/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Débloquer · 2 h' }))

    await waitFor(() => expect(useCanvasStore.getState().selectedColor).toBe(6))
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes('/api/unlocks/color%3A6') && init?.method === 'POST')).toBe(true)
    expect(screen.getByRole('button', { name: 'Orange' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('region', { name: 'Débloquer le orange' })).toBeNull()
  })

  test('désélectionne une couleur qui devient verrouillée', async () => {
    useCanvasStore.setState({ selectedColor: 6 })
    await loadTree()
    renderPalette()
    expect(useCanvasStore.getState().selectedColor).toBeNull()
  })

  test('« Voir la progression » ouvre l\'arbre sur la couleur', async () => {
    await loadTree()
    renderPalette()
    await userEvent.click(screen.getByRole('button', { name: /Orange, verrouillée/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Voir la progression' }))
    expect(useHudStore.getState()).toMatchObject({ panel: 'unlocks', focusNode: 'color:6', lockedHint: null })
  })
})

describe('Échap dans le HUD', () => {
  test('referme d\'abord le détail d\'une couleur verrouillée, puis rend la couleur active', () => {
    renderHook(() => useEscapeReturnsToExploration())
    useCanvasStore.setState({ selectedColor: 5 })
    useHudStore.setState({ lockedHint: 6 })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useHudStore.getState().lockedHint).toBeNull()
    expect(useCanvasStore.getState().selectedColor).toBe(5)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useCanvasStore.getState().selectedColor).toBeNull()
  })

  test('laisse un panneau ouvert gérer Échap', () => {
    renderHook(() => useEscapeReturnsToExploration())
    useCanvasStore.setState({ selectedColor: 5 })
    useHudStore.setState({ panel: 'help' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useCanvasStore.getState().selectedColor).toBe(5)
  })
})

// ── Pose ─────────────────────────────────────────────────────────────────────

describe('placePixel et verrous', () => {
  test('ne pose pas une couleur verrouillée', async () => {
    await loadTree()
    useCanvasStore.setState({ selectedColor: 6 })
    useCanvasStore.getState().placePixel(1, 1, 'alice')
    expect(socket.emit).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().grid![2048 + 1]).toBe(0)
  })

  test('resynchronise la palette quand le serveur refuse une couleur verrouillée', async () => {
    await loadTree()
    useCanvasStore.setState({ selectedColor: 5 })
    useCanvasStore.getState().placePixel(1, 1, 'alice')
    const ack = vi.mocked(socket.emit).mock.calls[0][2] as (a: unknown) => void
    fetchMock.mockClear()

    act(() => ack({ error: 'La couleur Rouge est verrouillée', code: 'color_locked' }))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/unlocks/tree'), expect.anything())
    expect(useCanvasStore.getState().grid![2048 + 1]).toBe(0)
  })
})

// ── Panneau de progression ──────────────────────────────────────────────────

describe('<UnlockPanel />', () => {
  test('montre streak, niveaux et conditions avec leur progression', async () => {
    render(<UnlockPanel open onClose={() => {}} />)
    expect(await screen.findByText('Niveau 2 — mélanges primaires')).toBeTruthy()
    expect(screen.getByText('3 h')).toBeTruthy()
    expect(screen.getByText('5/16')).toBeTruthy()
    const orange = screen.getByRole('article', { name: 'Orange' })
    expect(orange.textContent).toContain('Poser 10 pixels en jaune')
    expect(orange.textContent).toContain('3/10')
  })

  test('signale le streak manquant sans proposer de déblocage', async () => {
    treeResponse = treeWith(orangeReady, 1)
    render(<UnlockPanel open onClose={() => {}} />)
    const orange = await screen.findByRole('article', { name: 'Orange' })
    expect(orange.textContent).toContain('Il te manque 1 h de streak.')
    expect(screen.queryByRole('button', { name: /Débloquer/ })).toBeNull()
  })

  test('débloque un nœud prêt', async () => {
    treeResponse = treeWith(orangeReady)
    render(<UnlockPanel open onClose={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Débloquer · 2 h' }))
    expect(await screen.findByRole('article', { name: 'Orange, débloquée' })).toBeTruthy()
  })

  test('marque les fonctionnalités à venir, sans bouton', async () => {
    render(<UnlockPanel open onClose={() => {}} />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Fonctionnalités' }))
    const card = screen.getByRole('article', { name: 'Heatmap, à venir' })
    expect(card.querySelector('button')).toBeNull()
  })

  test('onglets au clavier', async () => {
    render(<UnlockPanel open onClose={() => {}} />)
    const colors = await screen.findByRole('tab', { name: 'Couleurs' })
    fireEvent.keyDown(colors, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Fonctionnalités' }).getAttribute('aria-selected')).toBe('true')
  })

  test('s\'ouvre sur l\'onglet du nœud demandé', async () => {
    useHudStore.setState({ focusNode: 'feature:heatmap' })
    Element.prototype.scrollIntoView = vi.fn()
    render(<UnlockPanel open onClose={() => {}} />)
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Fonctionnalités' }).getAttribute('aria-selected')).toBe('true'))
  })
})
