import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { socket } from '@features/realtime/socket'
import { ROLE_COOLDOWNS, type UserRole } from '@voxelplace/types'

export type { UserRole }
export { ROLE_COOLDOWNS }

export const DEFAULT_COLORS = [
  '#FFFFFF', // 0  blanc
  '#AAAAAA', // 1  gris clair
  '#888888', // 2  gris
  '#000000', // 3  noir
  '#884422', // 4  marron
  '#FF4444', // 5  rouge
  '#FF8800', // 6  orange
  '#FFFF00', // 7  jaune
  '#88CC22', // 8  vert clair
  '#00AA00', // 9  vert
  '#00AAAA', // 10 cyan
  '#44AAFF', // 11 bleu clair
  '#4444FF', // 12 bleu
  '#AA00AA', // 13 violet
  '#FF44FF', // 14 magenta
  '#FF88AA', // 15 rose
]

/**
 * Indices des pixels modifiés depuis le dernier rendu.
 *
 * Volontairement hors du store : cette file est vidée par le moteur de rendu à
 * chaque frame, et n'a aucune raison de déclencher un rendu React.
 */
const dirtyPixels: number[] = []

/** Vide la file et renvoie les indices accumulés. */
export function drainDirtyPixels(): number[] {
  if (dirtyPixels.length === 0) return []
  return dirtyPixels.splice(0, dirtyPixels.length)
}

interface Players {
  count: number
  byPlatform: Record<string, number>
}

interface CanvasStore {
  grid: Uint8Array | null
  /**
   * Incrémenté à chaque modification de la grille.
   *
   * La grille est mutée en place : recopier 4 Mo à chaque pixel reçu était le
   * premier des trois coûts qui plafonnaient le rendu. Comme la référence ne
   * change plus, c'est ce compteur que les abonnés observent.
   */
  gridVersion: number
  gridSize: number
  selectedColor: number | null
  hoveredPixel: { x: number; y: number } | null
  cursorScreenPos: { x: number; y: number } | null
  colors: string[]
  players: Players | null
  pixelSize: number
  gridOffset: { x: number; y: number }
  cooldownEnd: number | null
  cooldownDuration: number
  role: UserRole | null   // null = non connecté (lecture seule)
  isEditMode: boolean

  setGrid: (grid: Uint8Array) => void
  setGridSize: (size: number) => void
  setSelectedColor: (colorId: number | null) => void
  setHoveredPixel: (pixel: { x: number; y: number } | null) => void
  setCursorScreenPos: (pos: { x: number; y: number } | null) => void
  setColors: (colors: string[]) => void
  setPlayers: (players: Players) => void
  setPixelSize: (size: number) => void
  setGridOffset: (offset: { x: number; y: number }) => void
  setCooldown: (ms: number) => void
  updatePixel: (x: number, y: number, colorId: number) => void
  placePixel: (x: number, y: number, username: string) => void
  setRole: (role: UserRole | null) => void
  setIsEditMode: (isEditMode: boolean) => void
}

export const useCanvasStore = create<CanvasStore>()(
  subscribeWithSelector((set, get) => ({
    grid: null,
    gridVersion: 0,
    gridSize: 2048,
    selectedColor: null,
    hoveredPixel: null,
    colors: DEFAULT_COLORS,
    players: null,
    pixelSize: 4,
    gridOffset: { x: 0, y: 0 },
    cursorScreenPos: null,
    cooldownEnd: null,
    cooldownDuration: 0,
    role: null,
    isEditMode: true,

    setGrid: (grid) => {
      // Nouvelle grille complète : les modifications en attente n'ont plus de sens
      dirtyPixels.length = 0
      set({ grid, gridVersion: get().gridVersion + 1 })
    },
    setGridSize: (gridSize) => set({ gridSize }),
    setSelectedColor: (selectedColor) => set({ selectedColor }),
    setHoveredPixel: (hoveredPixel) => set({ hoveredPixel }),
    setColors: (colors) => set({ colors }),
    setPlayers: (players) => set({ players }),
    setPixelSize: (pixelSize) => set({ pixelSize }),
    setGridOffset: (gridOffset) => set({ gridOffset }),
    setCooldown: (ms) => set({ cooldownEnd: Date.now() + ms, cooldownDuration: ms }),
    setCursorScreenPos: (cursorScreenPos) => set({ cursorScreenPos }),
    setRole: (role) => set({ role }),
    setIsEditMode: (isEditMode) => set({ isEditMode }),

    updatePixel: (x, y, colorId) => {
      const { grid, gridSize, gridVersion } = get()
      if (!grid) return
      const index = y * gridSize + x
      if (grid[index] === colorId) return   // rien n'a changé

      grid[index] = colorId                 // mutation en place, aucune copie
      dirtyPixels.push(index)
      set({ gridVersion: gridVersion + 1 })
    },

    placePixel: (x, y, username) => {
      const { selectedColor, grid, gridSize, updatePixel, role, isEditMode } = get()
      if (!role) return                  // non connecté → lecture seule
      if (selectedColor === null) return
      if (!isEditMode) return
      if (!grid || x < 0 || x >= gridSize || y < 0 || y >= gridSize) return

      // Relevée avant la pose : la grille étant mutée en place, la relire
      // après ne rendrait plus que la couleur qu'on vient d'écrire.
      const previousColor = grid[y * gridSize + x]

      const cooldownMs = ROLE_COOLDOWNS[role]
      updatePixel(x, y, selectedColor)
      if (cooldownMs > 0) get().setCooldown(cooldownMs)

      socket.emit(
        'pixel:place',
        { x, y, colorId: selectedColor, username, source: 'web' },
        (ack: { ok?: boolean; error?: string; cooldown?: number; role?: UserRole }) => {
          if (!ack?.ok) {
            // rollback de l'optimistic update
            console.warn('[pixel:place] rejected:', ack?.error)
            updatePixel(x, y, previousColor)
          }
          // Met à jour le cooldown avec la valeur réelle du serveur (en ms)
          if (typeof ack?.cooldown === 'number' && ack.cooldown > 0) {
            get().setCooldown(ack.cooldown)
          }
          // Met à jour le rôle si le serveur en renvoie un
          if (ack?.role) get().setRole(ack.role)
        },
      )
    },
  })),
)
