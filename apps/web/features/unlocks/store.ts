'use client'

import { create } from 'zustand'
import { fetchTree, unlockNode, type TreeNode } from './api'

interface UnlocksState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  tree:   TreeNode[]
  /** Couleurs posables ; null tant qu'elles ne sont pas connues (aucune n'est alors verrouillée à l'écran). */
  colors: number[] | null
  streak: number | null
  /** Recharge l'arbre, la palette et le streak depuis le serveur. */
  load:   () => Promise<void>
  /** Débloque un nœud puis recharge. Rejette avec le message du serveur. */
  unlock: (nodeId: string) => Promise<void>
}

// Chaque chargement porte un numéro : une réponse lente d'avant une connexion
// ne doit pas écraser celle d'après.
let generation = 0

export const useUnlocksStore = create<UnlocksState>((set, get) => ({
  status: 'idle',
  tree:   [],
  colors: null,
  streak: null,

  load: async () => {
    const mine = ++generation
    set({ status: get().status === 'ready' ? 'ready' : 'loading' })
    try {
      const data = await fetchTree()
      if (mine !== generation) return
      set({ status: 'ready', tree: data.tree, colors: data.colors, streak: data.streak_hours })
    } catch {
      if (mine !== generation) return
      // Le serveur applique les verrous de toute façon : sans données, la
      // palette reste ouverte plutôt que de tout bloquer à tort.
      set({ status: 'error' })
    }
  },

  unlock: async (nodeId) => {
    await unlockNode(nodeId)
    await get().load()
  },
}))
