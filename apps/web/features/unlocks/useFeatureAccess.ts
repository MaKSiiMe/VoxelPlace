'use client'

import { useCanvasStore } from '@features/canvas/store'
import { useUnlocksStore } from './store'

const STAFF = new Set(['superuser', 'admin', 'superadmin'])

export type FeatureAccess = 'hidden' | 'locked' | 'open'

/**
 * Accès à une fonctionnalité de l'arbre, selon la même règle que le serveur
 * (requireFeature) : débloquée, ou d'office pour l'équipe. Masquée aux visiteurs.
 */
export function useFeatureAccess(nodeId: string): FeatureAccess {
  const role     = useCanvasStore((s) => s.role)
  const unlocked = useUnlocksStore((s) => s.tree.find((n) => n.nodeId === nodeId)?.unlocked ?? false)
  if (!role) return 'hidden'
  return unlocked || STAFF.has(role) ? 'open' : 'locked'
}
