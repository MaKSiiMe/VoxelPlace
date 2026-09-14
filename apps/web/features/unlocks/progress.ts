import { COLOR_NAMES } from '@features/canvas/store'
import type { Condition, TreeNode } from './api'

export const PALETTE_SIZE = 16

/** Couleurs verrouillées, d'après la liste des couleurs posables. Inconnue → aucune. */
export function lockedColorsFrom(colors: readonly number[] | null): Set<number> {
  if (!colors) return new Set()
  const allowed = new Set(colors)
  const locked  = new Set<number>()
  for (let id = 0; id < PALETTE_SIZE; id++) if (!allowed.has(id)) locked.add(id)
  return locked
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

/** Libellé lisible d'une condition, et couleur à illustrer le cas échéant. */
export function describeCondition(cond: Condition, tree: readonly TreeNode[]): { label: string; colorId?: number } {
  const n = cond.min ?? 0
  switch (cond.type) {
    case 'color_count':
      return { label: `Poser ${plural(n, 'pixel')} en ${COLOR_NAMES[cond.colorId ?? 0]?.toLowerCase()}`, colorId: cond.colorId }
    case 'color_unlocked':
      return { label: `Débloquer le ${COLOR_NAMES[cond.colorId ?? 0]?.toLowerCase()}`, colorId: cond.colorId }
    case 'feature_unlocked': {
      const name = tree.find((node) => node.nodeId === cond.nodeId)?.name ?? cond.nodeId
      return { label: `Débloquer « ${name} »` }
    }
    case 'pixels_placed':         return { label: `Poser ${plural(n, 'pixel')}` }
    case 'pixels_lost':           return { label: `Te faire recouvrir ${plural(n, 'pixel')}` }
    case 'pixels_overwritten':    return { label: `Recouvrir ${plural(n, 'pixel')} d'autres joueurs` }
    case 'days_played':           return { label: `Jouer ${plural(n, 'jour')} différent${n > 1 ? 's' : ''}` }
    case 'zones_visited':         return { label: `Poser dans ${plural(n, 'zone')} différente${n > 1 ? 's' : ''}` }
    case 'rank_top':              return { label: `Entrer dans le top ${cond.max} du classement` }
    case 'all_features_unlocked': return { label: 'Débloquer toutes les fonctionnalités' }
    case 'color_each_unlocked':   return { label: 'Poser un pixel de chaque couleur débloquée' }
    case 'color_level4_any':      return { label: 'Débloquer une couleur de niveau 4' }
    default:                      return { label: 'Condition spéciale' }
  }
}

export type NodeStatus =
  | 'unlocked'
  | 'coming_soon'
  /** Conditions remplies, streak suffisant : un clic suffit. */
  | 'ready'
  /** Conditions remplies, mais pas assez d'heures de streak. */
  | 'needs_streak'
  | 'locked'

export function nodeStatus(node: TreeNode, streak: number | null): NodeStatus {
  if (node.unlocked)   return 'unlocked'
  if (node.comingSoon) return 'coming_soon'
  // Sans progression (visiteur), rien n'est réputé rempli
  if (!node.conditions.every((c) => c.met === true)) return 'locked'
  return (streak ?? 0) >= node.streakCost ? 'ready' : 'needs_streak'
}

/** Nœud de l'arbre correspondant à une couleur de la palette. */
export function colorNode(tree: readonly TreeNode[], colorId: number): TreeNode | undefined {
  return tree.find((node) => node.type === 'color' && node.colorId === colorId)
}
