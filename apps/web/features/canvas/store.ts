import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { socket } from '@features/realtime/socket'

export type UserRole = 'user' | 'superuser' | 'admin' | 'superadmin'

// Cooldown optimiste côté client — doit correspondre au serveur
export const ROLE_COOLDOWNS: Record<UserRole, number> = {
  user:        60_000,
  superuser:    1_000,
  admin:        5_000,
  superadmin:       0,
}

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

interface Players {
  count: number
  byPlatform: Record<string, number>
}

interface CanvasStore {
  grid: Uint8Array | null
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

    setGrid: (grid) => set({ grid }),
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

    updatePixel: (x, y, colorId) =>
      set((state) => {
        if (!state.grid) return {}
        const next = new Uint8Array(state.grid)
        next[y * state.gridSize + x] = colorId
        return { grid: next }
      }),

    placePixel: (x, y, username) => {
      const { selectedColor, grid, gridSize, updatePixel, role, isEditMode } = get()
      if (!role) return                  // non connecté → lecture seule
      if (selectedColor === null) return
      if (!isEditMode) return
      if (!grid || x < 0 || x >= gridSize || y < 0 || y >= gridSize) return

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
            updatePixel(x, y, grid[y * gridSize + x])
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
