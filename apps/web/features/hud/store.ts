'use client'

import { create } from 'zustand'

/** Panneaux ouvrables depuis la barre d'outils. Un seul à la fois. */
export type PanelId = 'leaderboard' | 'stats' | 'unlocks' | 'settings' | 'help'

interface HudState {
  panel:       PanelId | null
  minimapOpen: boolean
  /** Couleur verrouillée dont la palette détaille les conditions de déblocage. */
  lockedHint:  number | null
  /** Nœud à mettre en avant à l'ouverture de la progression. */
  focusNode:   string | null
  togglePanel: (id: PanelId) => void
  openProgression: (nodeId?: string) => void
  closePanel:  () => void
  setMinimapOpen: (open: boolean) => void
  setLockedHint:  (colorId: number | null) => void
}

// L'ancien store de ce fichier (useCockpitStore) n'était importé nulle part.
export const useHudStore = create<HudState>((set, get) => ({
  panel:       null,
  minimapOpen: true,
  lockedHint:  null,
  focusNode:   null,
  togglePanel: (id) => set({ panel: get().panel === id ? null : id, focusNode: null }),
  openProgression: (nodeId) => set({ panel: 'unlocks', focusNode: nodeId ?? null, lockedHint: null }),
  closePanel:  () => set({ panel: null, focusNode: null }),
  setMinimapOpen: (minimapOpen) => set({ minimapOpen }),
  setLockedHint:  (lockedHint) => set({ lockedHint }),
}))
