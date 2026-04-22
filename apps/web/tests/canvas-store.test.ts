import { describe, test, expect, beforeEach, vi } from 'vitest'

// Mocké avant l'import du store pour éviter la connexion socket.io au chargement
vi.mock('@features/realtime/socket', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))

import { useCanvasStore, DEFAULT_COLORS, ROLE_COOLDOWNS } from '../features/canvas/store'

// ── Constantes ────────────────────────────────────────────────────────────────

describe('DEFAULT_COLORS', () => {
  test('contient exactement 16 couleurs', () => {
    expect(DEFAULT_COLORS).toHaveLength(16)
  })

  test('toutes les couleurs sont des chaînes hex valides (#RRGGBB)', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/
    for (const color of DEFAULT_COLORS) {
      expect(color).toMatch(hexPattern)
    }
  })

  test('index 0 est blanc et index 3 est noir', () => {
    expect(DEFAULT_COLORS[0]).toBe('#FFFFFF')
    expect(DEFAULT_COLORS[3]).toBe('#000000')
  })
})

describe('ROLE_COOLDOWNS', () => {
  test('user → 60 secondes', ()       => expect(ROLE_COOLDOWNS.user).toBe(60_000))
  test('superuser → pas de délai', () => expect(ROLE_COOLDOWNS.superuser).toBe(0))
  test('admin → pas de délai', ()     => expect(ROLE_COOLDOWNS.admin).toBe(0))
  test('superadmin → pas de délai', () => expect(ROLE_COOLDOWNS.superadmin).toBe(0))
})

// ── updatePixel ───────────────────────────────────────────────────────────────

describe('CanvasStore — updatePixel', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      grid:     new Uint8Array(2048 * 2048),
      gridSize: 2048,
    })
  })

  test('modifie le pixel à la bonne position (formule y * gridSize + x)', () => {
    useCanvasStore.getState().updatePixel(5, 3, 7)
    const { grid, gridSize } = useCanvasStore.getState()
    expect(grid![3 * gridSize + 5]).toBe(7)
  })

  test('ne touche pas les pixels adjacents', () => {
    useCanvasStore.getState().updatePixel(10, 10, 4)
    const { grid, gridSize } = useCanvasStore.getState()
    expect(grid![10 * gridSize + 10]).toBe(4)
    expect(grid![10 * gridSize + 11]).toBe(0)
    expect(grid![11 * gridSize + 10]).toBe(0)
  })

  test('coin haut-gauche (0,0)', () => {
    useCanvasStore.getState().updatePixel(0, 0, 15)
    expect(useCanvasStore.getState().grid![0]).toBe(15)
  })

  test('ne plante pas si la grille est null', () => {
    useCanvasStore.setState({ grid: null })
    expect(() => useCanvasStore.getState().updatePixel(0, 0, 1)).not.toThrow()
  })
})

// ── setCooldown ───────────────────────────────────────────────────────────────

describe('CanvasStore — setCooldown', () => {
  test('cooldownEnd est dans le futur (Date.now() + ms)', () => {
    const before = Date.now()
    useCanvasStore.getState().setCooldown(5_000)
    const { cooldownEnd } = useCanvasStore.getState()
    expect(cooldownEnd).toBeGreaterThanOrEqual(before + 5_000)
  })

  test('cooldownDuration reflète la valeur passée', () => {
    useCanvasStore.getState().setCooldown(30_000)
    expect(useCanvasStore.getState().cooldownDuration).toBe(30_000)
  })
})

// ── placePixel — guards ───────────────────────────────────────────────────────

describe('CanvasStore — placePixel (guards)', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      grid:          new Uint8Array(2048 * 2048),
      gridSize:      2048,
      role:          null,
      selectedColor: null,
      isEditMode:    true,
    })
  })

  test('ne place rien si le joueur n\'est pas connecté (role = null)', () => {
    useCanvasStore.setState({ selectedColor: 5 })
    useCanvasStore.getState().placePixel(0, 0, 'guest')
    expect(useCanvasStore.getState().grid![0]).toBe(0)
  })

  test('ne place rien si aucune couleur n\'est sélectionnée', () => {
    useCanvasStore.setState({ role: 'user', selectedColor: null })
    useCanvasStore.getState().placePixel(0, 0, 'alice')
    expect(useCanvasStore.getState().grid![0]).toBe(0)
  })

  test('ne place rien si le mode édition est désactivé', () => {
    useCanvasStore.setState({ role: 'user', selectedColor: 3, isEditMode: false })
    useCanvasStore.getState().placePixel(0, 0, 'alice')
    expect(useCanvasStore.getState().grid![0]).toBe(0)
  })

  test('place le pixel de façon optimiste si tout est valide', () => {
    useCanvasStore.setState({ role: 'user', selectedColor: 7, isEditMode: true })
    useCanvasStore.getState().placePixel(1, 1, 'alice')
    // Mise à jour optimiste avant l'acquittement du serveur
    expect(useCanvasStore.getState().grid![1 * 2048 + 1]).toBe(7)
  })
})
