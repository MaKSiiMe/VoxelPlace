import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { socket } from '@features/realtime/socket'

export const PLACE_COOLDOWN_MS = 10000

export const DEFAULT_COLORS = [
  '#E2E2E2', // 0 blanc doux
  '#000000', // 1 noir pur
  '#FF4D4D', // 2 rouge
  '#00E676', // 3 vert vibrant
  '#2979FF', // 4 bleu électrique
  '#FFEA00', // 5 jaune solaire
  '#FF9100', // 6 orange
  '#D500F9', // 7 violet néon
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

    updatePixel: (x, y, colorId) =>
      set((state) => {
        if (!state.grid) return {}
        const next = new Uint8Array(state.grid)
        next[y * state.gridSize + x] = colorId
        return { grid: next }
      }),

    placePixel: (x, y, username) => {
      const { selectedColor, grid, gridSize, updatePixel } = get()
      if (selectedColor === null) return
      if (!grid || x < 0 || x >= gridSize || y < 0 || y >= gridSize) return
      updatePixel(x, y, selectedColor)
      set({ selectedColor: null })
      get().setCooldown(PLACE_COOLDOWN_MS)
      socket.emit(
        'pixel:place',
        { x, y, colorId: selectedColor, username, source: 'web' },
        (ack: { ok?: boolean; error?: string; cooldown?: number }) => {
          if (ack?.cooldown) get().setCooldown(ack.cooldown)
          if (!ack?.ok) {
            console.warn('[pixel:place] rejected:', ack?.error)
            updatePixel(x, y, grid[y * gridSize + x])
          }
        },
      )
    },
  })),
)
