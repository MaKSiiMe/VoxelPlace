'use client'

import { create } from 'zustand'

/** Panneaux ouvrables depuis la barre d'outils. Un seul à la fois. */
export type PanelId = 'leaderboard' | 'stats' | 'unlocks' | 'settings' | 'help'

interface HudState {
  panel:       PanelId | null
  minimapOpen: boolean
  togglePanel: (id: PanelId) => void
  closePanel:  () => void
  setMinimapOpen: (open: boolean) => void
}

// L'ancien store de ce fichier (useCockpitStore) n'était importé nulle part.
export const useHudStore = create<HudState>((set, get) => ({
  panel:       null,
  minimapOpen: true,
  togglePanel: (id) => set({ panel: get().panel === id ? null : id }),
  closePanel:  () => set({ panel: null }),
  setMinimapOpen: (minimapOpen) => set({ minimapOpen }),
}))
