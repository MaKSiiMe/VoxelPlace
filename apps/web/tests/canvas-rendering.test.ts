import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('@features/realtime/socket', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))

import { useCanvasStore, drainDirtyPixels } from '../features/canvas/store'

// Le canvas de production fait 2048² ; 64² suffit à vérifier la mécanique
// et garde les tests instantanés.
const SIZE = 64

function resetStore() {
  drainDirtyPixels()
  useCanvasStore.setState({
    grid:          new Uint8Array(SIZE * SIZE),
    gridSize:      SIZE,
    gridVersion:   0,
    role:          'user',
    selectedColor: null,
    isEditMode:    true,
  })
}

describe('rendu incrémental — mutation en place', () => {
  beforeEach(resetStore)

  test('la grille garde la même référence après une modification', () => {
    // Recopier 4 Mo à chaque pixel reçu était le premier coût du rendu :
    // à 10 pixels/seconde, la copie seule représentait 40 Mo par seconde.
    const before = useCanvasStore.getState().grid
    useCanvasStore.getState().updatePixel(1, 1, 5)
    expect(useCanvasStore.getState().grid).toBe(before)
  })

  test('le compteur de version signale le changement', () => {
    const before = useCanvasStore.getState().gridVersion
    useCanvasStore.getState().updatePixel(1, 1, 5)
    expect(useCanvasStore.getState().gridVersion).toBe(before + 1)
  })

  test('une écriture sans changement de couleur ne produit rien', () => {
    useCanvasStore.getState().updatePixel(2, 2, 7)
    drainDirtyPixels()
    const version = useCanvasStore.getState().gridVersion

    useCanvasStore.getState().updatePixel(2, 2, 7)   // même couleur
    expect(useCanvasStore.getState().gridVersion).toBe(version)
    expect(drainDirtyPixels()).toEqual([])
  })
})

describe('file des pixels modifiés', () => {
  beforeEach(resetStore)

  test("n'accumule que les pixels effectivement touchés", () => {
    useCanvasStore.getState().updatePixel(3, 4, 9)
    expect(drainDirtyPixels()).toEqual([4 * SIZE + 3])
  })

  test('conserve l\'ordre des modifications', () => {
    useCanvasStore.getState().updatePixel(1, 0, 1)
    useCanvasStore.getState().updatePixel(2, 0, 2)
    useCanvasStore.getState().updatePixel(3, 0, 3)
    expect(drainDirtyPixels()).toEqual([1, 2, 3])
  })

  test('se vide une fois lue — le rendu suivant ne refait pas le travail', () => {
    useCanvasStore.getState().updatePixel(1, 1, 5)
    expect(drainDirtyPixels()).toHaveLength(1)
    expect(drainDirtyPixels()).toHaveLength(0)
  })

  test('est purgée par le chargement d\'une grille complète', () => {
    useCanvasStore.getState().updatePixel(1, 1, 5)
    // Les indices en attente ne désignent plus rien de valide
    useCanvasStore.getState().setGrid(new Uint8Array(SIZE * SIZE))
    expect(drainDirtyPixels()).toEqual([])
  })

  test('setGrid incrémente aussi la version', () => {
    const before = useCanvasStore.getState().gridVersion
    useCanvasStore.getState().setGrid(new Uint8Array(SIZE * SIZE))
    expect(useCanvasStore.getState().gridVersion).toBe(before + 1)
  })
})

describe('placePixel — rollback', () => {
  beforeEach(() => {
    resetStore()
    useCanvasStore.setState({ selectedColor: 9 })
  })

  test('restaure la couleur d\'origine quand le serveur refuse', async () => {
    const { socket } = await import('@features/realtime/socket')
    // Le serveur refuse : le troisième argument est le callback d'acquittement
    vi.mocked(socket.emit).mockImplementation((...args: unknown[]) => {
      const ack = args[2] as (r: unknown) => void
      ack({ error: 'Trop vite !' })
      return socket
    })

    const grid = useCanvasStore.getState().grid!
    grid[5 * SIZE + 5] = 3            // couleur en place avant la tentative

    useCanvasStore.getState().placePixel(5, 5, 'alice')

    // La grille étant mutée en place, relire la couleur après la pose
    // optimiste renverrait 9 : le rollback doit s'appuyer sur la valeur
    // relevée avant.
    expect(useCanvasStore.getState().grid![5 * SIZE + 5]).toBe(3)
  })

  test('explique le refus au joueur au lieu d\'annuler la pose en silence', async () => {
    const { socket } = await import('@features/realtime/socket')
    const { useNotifications } = await import('../features/notifications/store')
    useNotifications.getState().clear()
    vi.mocked(socket.emit).mockImplementation((...args: unknown[]) => {
      const ack = args[2] as (r: unknown) => void
      ack({ error: 'Trop vite ! Attends 42s.' })
      return socket
    })

    useCanvasStore.getState().placePixel(7, 7, 'alice')

    const items = useNotifications.getState().items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'error', message: 'Trop vite ! Attends 42s.' })
    useNotifications.getState().clear()
  })

  test('conserve la couleur posée quand le serveur accepte', async () => {
    const { socket } = await import('@features/realtime/socket')
    vi.mocked(socket.emit).mockImplementation((...args: unknown[]) => {
      const ack = args[2] as (r: unknown) => void
      ack({ ok: true })
      return socket
    })

    useCanvasStore.getState().placePixel(6, 6, 'alice')
    expect(useCanvasStore.getState().grid![6 * SIZE + 6]).toBe(9)
  })
})
