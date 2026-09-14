'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@features/auth/store'
import { useHudStore } from '@features/hud/store'
import { useUnlocksStore } from '@features/unlocks/store'
import { useFeatureAccess } from '@features/unlocks/useFeatureAccess'
import { ConditionList } from '@features/unlocks/components/ConditionList'
import { Button, Dialog, cn, LockIcon } from '@shared/ui'
import { fetchTimelapse, TimelapseError, type TimelapsePeriod, type TimelapseScope } from '../api'

const SCOPES: { value: TimelapseScope; label: string; nodeId: string }[] = [
  { value: 'me',     label: 'Mes pixels',     nodeId: 'feature:timelapse_personal' },
  { value: 'canvas', label: 'Toute la toile', nodeId: 'feature:timelapse_global' },
]

const PERIODS: { value: TimelapsePeriod; label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '7d',  label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: 'all', label: 'Depuis le début' },
]

type Result =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; url: string; filename: string }
  | { status: 'error'; message: string }

/**
 * Timelapse en GIF : ses propres pixels, ou toute la toile. Aperçu animé et
 * téléchargement. Le serveur borne l'image (1024 px, 100 images) et l'encode
 * hors du fil temps réel ; comptez quelques secondes.
 */
export function TimelapseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const username = useAuthStore((s) => s.username)
  const [scope,  setScope]  = useState<TimelapseScope>('me')
  const [period, setPeriod] = useState<TimelapsePeriod>('7d')
  const [result, setResult] = useState<Result>({ status: 'idle' })
  const controllerRef = useRef<AbortController | null>(null)
  const nodeId = SCOPES.find((s) => s.value === scope)!.nodeId
  const access = useFeatureAccess(nodeId)

  // Un aperçu ne vaut que pour ses réglages : les changer, ou fermer, le libère
  useEffect(() => { reset() }, [scope, period, open])
  useEffect(() => () => reset(), [])
  function reset() {
    controllerRef.current?.abort()
    setResult((prev) => {
      if (prev.status === 'ready') URL.revokeObjectURL(prev.url)
      return { status: 'idle' }
    })
  }

  async function generate() {
    reset()
    const controller = new AbortController()
    controllerRef.current = controller
    setResult({ status: 'loading' })
    try {
      const blob = await fetchTimelapse(scope, period, username, controller.signal)
      if (controller.signal.aborted) return
      const filename = `voxelplace-${scope === 'me' ? username : 'toile'}-${period}.gif`
      setResult({ status: 'ready', url: URL.createObjectURL(blob), filename })
    } catch (err) {
      if (controller.signal.aborted) return
      // Un refus veut dire que l'arbre affiché est périmé : on le resynchronise
      if (err instanceof TimelapseError && err.status === 403) void useUnlocksStore.getState().load()
      setResult({ status: 'error', message: err instanceof Error ? err.message : 'Impossible de générer le timelapse.' })
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="md" title="Timelapse" description="Revois la toile se dessiner, puis télécharge le GIF.">
      <div className="flex flex-col gap-4">
        <Choice label="Contenu" value={scope} options={SCOPES} onChange={setScope} />
        <Choice label="Période" value={period} options={PERIODS} onChange={setPeriod} />

        {access === 'locked' ? (
          <LockedNode nodeId={nodeId} />
        ) : (
          <>
            <Button variant="primary" onClick={generate} disabled={result.status === 'loading'} className="self-start">
              {result.status === 'loading' ? 'Génération…' : 'Générer le timelapse'}
            </Button>

            <p role="status" className="sr-only">
              {result.status === 'loading' && 'Génération du timelapse en cours.'}
              {result.status === 'ready' && 'Timelapse prêt.'}
            </p>
            {result.status === 'loading' && <p className="text-sm text-fg-muted" aria-hidden="true">Quelques secondes : chaque image est reconstruite pose après pose.</p>}
            {result.status === 'error' && <p role="alert" className="text-sm text-danger">{result.message}</p>}

            {result.status === 'ready' && (
              <figure className="flex flex-col gap-3">
                <img
                  src={result.url}
                  alt={scope === 'me' ? 'Timelapse animé de tes pixels' : 'Timelapse animé de toute la toile'}
                  className="aspect-square w-full rounded-control bg-bg object-contain [image-rendering:pixelated]"
                />
                <a
                  href={result.url}
                  download={result.filename}
                  className="inline-flex h-10 items-center justify-center self-start rounded-control border border-line bg-surface-2 px-4 text-sm font-medium text-fg hover:border-line-strong"
                >
                  Télécharger le GIF
                </a>
              </figure>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">{label}</legend>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-control bg-bg p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 flex-1 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors',
              value === o.value ? 'bg-surface-2 text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function LockedNode({ nodeId }: { nodeId: string }) {
  const tree   = useUnlocksStore((s) => s.tree)
  const streak = useUnlocksStore((s) => s.streak)
  const openProgression = useHudStore((s) => s.openProgression)
  const node = tree.find((n) => n.nodeId === nodeId)
  return (
    <section aria-label="À débloquer" className="flex flex-col gap-3 rounded-control border border-line p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-fg">
        <span className="inline-flex text-fg-muted [&>svg]:size-4" aria-hidden="true"><LockIcon /></span>
        À débloquer dans ta progression
      </p>
      {node && <ConditionList node={node} tree={tree} streak={streak} />}
      <Button size="sm" variant="secondary" className="self-start" onClick={() => openProgression(nodeId)}>Voir la progression</Button>
    </section>
  )
}
