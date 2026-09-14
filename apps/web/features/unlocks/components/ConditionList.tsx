import { DEFAULT_COLORS } from '@features/canvas/store'
import { cn } from '@shared/ui'
import type { TreeNode } from '../api'
import { describeCondition } from '../progress'

interface Props {
  node:    TreeNode
  tree:    readonly TreeNode[]
  /** Heures de streak du joueur ; null pour un visiteur. */
  streak:  number | null
  compact?: boolean
}

/** Conditions d'un nœud, cochées au fur et à mesure, suivies de son coût en streak. */
export function ConditionList({ node, tree, streak, compact = false }: Props) {
  const rows = node.conditions.map((cond) => {
    const { label, colorId } = describeCondition(cond, tree)
    const progress = typeof cond.current === 'number' && typeof cond.target === 'number'
      ? `${Math.min(cond.current, cond.target)}/${cond.target}`
      : null
    return { label, colorId, met: cond.met, progress }
  })
  if (node.streakCost > 0) {
    rows.push({
      label:    `Dépenser ${node.streakCost} h de streak`,
      colorId:  undefined,
      met:      streak === null ? undefined : streak >= node.streakCost,
      progress: streak === null ? null : `${Math.min(streak, node.streakCost)}/${node.streakCost} h`,
    })
  }
  if (rows.length === 0) return null

  return (
    <ul className={cn('flex flex-col', compact ? 'gap-1' : 'gap-1.5')}>
      {rows.map((row, i) => (
        <li key={i} className="flex items-center gap-2 text-xs">
          <CheckMark met={row.met} />
          {row.colorId !== undefined && (
            <span
              className="size-3 shrink-0 rounded-[3px]"
              style={{ backgroundColor: DEFAULT_COLORS[row.colorId], boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .2)' }}
              aria-hidden="true"
            />
          )}
          <span className={cn('min-w-0 flex-1', row.met ? 'text-fg-subtle' : 'text-fg-muted')}>
            {row.label}
            {row.met !== undefined && <span className="sr-only">{row.met ? ' — rempli' : ' — pas encore'}</span>}
          </span>
          {row.progress && (
            <span className={cn('font-mono tabular-nums', row.met ? 'text-success' : 'text-fg-subtle')}>{row.progress}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function CheckMark({ met }: { met?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-3.5 shrink-0 place-items-center rounded-full border',
        met ? 'border-success bg-success text-on-accent' : 'border-line-strong',
      )}
    >
      {met && (
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m2.5 6.2 2.2 2.2 4.8-4.8" />
        </svg>
      )}
    </span>
  )
}
