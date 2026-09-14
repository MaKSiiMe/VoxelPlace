'use client'

import { create } from 'zustand'
import { fetchHeatmap, HeatmapLockedError, type Heatmap, type HeatmapPeriod } from './api'

interface HeatmapState {
  enabled: boolean
  period:  HeatmapPeriod
  status:  'idle' | 'loading' | 'ready' | 'error' | 'locked'
  data:    Heatmap | null
  setEnabled: (enabled: boolean) => void
  setPeriod:  (period: HeatmapPeriod) => void
  load:       () => Promise<void>
}

let controller: AbortController | null = null

export const useHeatmapStore = create<HeatmapState>((set, get) => ({
  enabled: false,
  period:  '24h',
  status:  'idle',
  data:    null,

  setEnabled: (enabled) => {
    set({ enabled })
    if (enabled) void get().load()
    else { controller?.abort(); set({ status: 'idle', data: null }) }
  },

  setPeriod: (period) => {
    if (period === get().period) return
    set({ period })
    if (get().enabled) void get().load()
  },

  load: async () => {
    // Un changement de période annule la requête précédente : sa réponse,
    // plus lente, afficherait sinon l'ancienne période sous le nouveau libellé.
    controller?.abort()
    const mine = new AbortController()
    controller = mine
    set({ status: 'loading' })
    try {
      const data = await fetchHeatmap(get().period, mine.signal)
      if (mine.signal.aborted || !get().enabled) return
      set({ status: 'ready', data })
    } catch (err) {
      if (mine.signal.aborted) return
      set({ status: err instanceof HeatmapLockedError ? 'locked' : 'error', data: null })
    }
  },
}))
