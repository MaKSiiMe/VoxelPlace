import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { socket } from '@features/realtime/socket'

const DEFAULT_COLORS = [
  '#FFFFFF', '#000000', '#FF4444', '#00AA00',
  '#4444FF', '#FFFF00', '#FF8800', '#AA00AA',
]

interface Players {
  count: number
  byPlatform: Record<string, number>
}

interface CanvasStore {
  grid: Uint8Array | null
  gridSize: number
  selectedColor: number
  hoveredPixel: { x: number; y: number } | null
  colors: string[]
  players: Players | null

  setGrid: (grid: Uint8Array) => void
  setGridSize: (size: number) => void
  setSelectedColor: (colorId: number) => void
  setHoveredPixel: (pixel: { x: number; y: number } | null) => void
  setColors: (colors: string[]) => void
  setPlayers: (players: Players) => void
  updatePixel: (x: number, y: number, colorId: number) => void
  placePixel: (x: number, y: number, username: string) => void
}

export const useCanvasStore = create<CanvasStore>()(
  subscribeWithSelector((set, get) => ({
    grid: null,
    gridSize: 64,
    selectedColor: 1,
    hoveredPixel: null,
    colors: DEFAULT_COLORS,
    players: null,

    setGrid: (grid) => set({ grid }),
    setGridSize: (gridSize) => set({ gridSize }),
    setSelectedColor: (selectedColor) => set({ selectedColor }),
    setHoveredPixel: (hoveredPixel) => set({ hoveredPixel }),
    setColors: (colors) => set({ colors }),
    setPlayers: (players) => set({ players }),

    updatePixel: (x, y, colorId) =>
      set((state) => {
        if (!state.grid) return {}
        const next = new Uint8Array(state.grid)
        next[y * state.gridSize + x] = colorId
        return { grid: next }
      }),

    placePixel: (x, y, username) => {
      const { selectedColor, grid, gridSize } = get()
      if (!grid || x < 0 || x >= gridSize || y < 0 || y >= gridSize) return
      socket.emit(
        'pixel:place',
        { x, y, colorId: selectedColor, username, source: 'web' },
        (ack: { ok?: boolean; error?: string; cooldown?: number }) => {
          if (!ack?.ok) console.warn('[pixel:place] rejected:', ack?.error)
        },
      )
    },
  })),
)
