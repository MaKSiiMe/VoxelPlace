'use client'

import { useCanvasStore } from '@features/canvas/store'
import { useUnlocksStore } from '@features/unlocks/store'
import { useHudStore } from '@features/hud/store'
import { IconButton, cn, CloseIcon, FlameIcon, LockIcon } from '@shared/ui'
import { useHeatmapStore } from '../store'
import { HEAT_GRADIENT } from '../render'
import type { HeatmapPeriod } from '../api'

const PERIODS: { value: HeatmapPeriod; label: string; long: string }[] = [
  { value: '1h',  label: '1 h',  long: 'la dernière heure' },
  { value: '24h', label: '24 h', long: 'les dernières 24 heures' },
  { value: '7d',  label: '7 j',  long: 'les 7 derniers jours' },
  { value: 'all', label: 'Tout', long: 'depuis le début' },
]

const STAFF = new Set(['superuser', 'admin', 'superadmin'])

/** Accès à la heatmap : débloquée dans l'arbre, ou d'office pour l'équipe (règle du serveur). */
export function useHeatmapAccess(): 'hidden' | 'locked' | 'open' {
  const role = useCanvasStore((s) => s.role)
  const unlocked = useUnlocksStore((s) => s.tree.find((n) => n.nodeId === 'feature:heatmap')?.unlocked ?? false)
  if (!role) return 'hidden'
  return unlocked || STAFF.has(role) ? 'open' : 'locked'
}

/** Bouton du groupe de vue. */
export function HeatmapToggle({ tooltipSide = 'top' }: { tooltipSide?: 'top' | 'left' }) {
  const access          = useHeatmapAccess()
  const enabled         = useHeatmapStore((s) => s.enabled)
  const setEnabled      = useHeatmapStore((s) => s.setEnabled)
  const openProgression = useHudStore((s) => s.openProgression)
  if (access === 'hidden') return null

  if (access === 'locked') {
    return (
      <IconButton
        label="Heatmap — à débloquer"
        size="sm"
        tooltipSide={tooltipSide}
        onClick={() => openProgression('feature:heatmap')}
        icon={<span className="relative inline-flex"><FlameIcon /><span className="absolute -bottom-1 -right-1.5 grid size-3 place-items-center rounded-full bg-surface [&>svg]:size-2.5"><LockIcon /></span></span>}
      />
    )
  }
  return (
    <IconButton
      label={enabled ? 'Masquer la heatmap' : 'Afficher la heatmap'}
      icon={<FlameIcon />}
      size="sm"
      tooltipSide={tooltipSide}
      pressed={enabled}
      onClick={() => setEnabled(!enabled)}
    />
  )
}

/** Période, légende et état de la heatmap affichée. */
export function HeatmapPanel() {
  const { enabled, period, status, data, setPeriod, setEnabled, load } = useHeatmapStore()
  if (!enabled) return null
  const current = PERIODS.find((p) => p.value === period)!

  return (
    <section aria-label="Heatmap" className="flex flex-col gap-2 border-b border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">Heatmap</h2>
        <IconButton label="Masquer la heatmap" icon={<CloseIcon />} size="sm" tooltipSide="left" className="-my-1 -mr-1" onClick={() => setEnabled(false)} />
      </div>

      <div role="group" aria-label="Période" className="grid grid-cols-4 gap-1 rounded-control bg-bg p-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={period === p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              'h-7 rounded-md text-xs font-medium transition-colors',
              period === p.value ? 'bg-surface-2 text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div aria-hidden="true">
        <div className="h-2 rounded-full" style={{ backgroundImage: HEAT_GRADIENT }} />
        <div className="mt-1 flex justify-between text-[11px] text-fg-subtle"><span>Peu de poses</span><span>Beaucoup</span></div>
      </div>

      <p role="status" className="text-xs text-fg-muted">
        {status === 'loading' && 'Chargement…'}
        {status === 'ready' && data && (data.total === 0
          ? `Aucune pose ${current.long}.`
          : `${data.total.toLocaleString('fr-FR')} poses ${current.long}.`)}
        {status === 'locked' && 'Heatmap à débloquer dans ta progression.'}
      </p>
      {status === 'error' && (
        <p role="alert" className="text-xs text-danger">
          Heatmap indisponible. <button type="button" className="underline underline-offset-2" onClick={() => void load()}>Réessayer</button>
        </p>
      )}
    </section>
  )
}
