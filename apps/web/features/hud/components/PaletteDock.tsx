'use client'

import { useEffect, useRef, useState } from 'react'
import { useCanvasStore, DEFAULT_COLORS, COLOR_NAMES } from '@features/canvas/store'
import { useUnlocksStore } from '@features/unlocks/store'
import { colorNode, nodeStatus } from '@features/unlocks/progress'
import { ConditionList } from '@features/unlocks/components/ConditionList'
import { useCooldown, formatRemaining } from '../cooldown'
import { useHudStore } from '../store'
import { Button, IconButton, Surface, cn, CloseIcon, EyeIcon, LockIcon } from '@shared/ui'

interface Props {
  onOpenAuth: () => void
  /** Couleurs non débloquées par le joueur. */
  lockedColors?: ReadonlySet<number>
}

/**
 * Palette toujours visible en bas de l'écran.
 *
 * Elle était cachée dans une pilule que le bandeau cookies recouvrait, et le
 * bouton de connexion pour les visiteurs était coloré à 1,63:1. Le cooldown,
 * autrefois signalé par la seule lueur du cadre, s'affiche ici en clair.
 *
 * Une couleur verrouillée reste cliquable : elle affiche ce qu'il faut faire
 * pour la débloquer, au lieu d'un bouton inerte sans explication.
 */
export function PaletteDock({ onOpenAuth, lockedColors = new Set() }: Props) {
  const role        = useCanvasStore((s) => s.role)
  const selected    = useCanvasStore((s) => s.selectedColor)
  const isEditMode  = useCanvasStore((s) => s.isEditMode)
  const setSelected = useCanvasStore((s) => s.setSelectedColor)
  const hint        = useHudStore((s) => s.lockedHint)
  const setHint     = useHudStore((s) => s.setLockedHint)
  const cooldown    = useCooldown()
  const readyAnnouncement = useReadyAnnouncement(cooldown.active)

  // Une couleur sélectionnée qui devient verrouillée (déconnexion, rôle
  // retiré) ne doit pas rester l'outil actif ; une couleur tout juste
  // débloquée referme ses conditions.
  useEffect(() => {
    if (selected !== null && lockedColors.has(selected)) setSelected(null)
    if (hint !== null && !lockedColors.has(hint)) setHint(null)
  }, [lockedColors, selected, setSelected, hint, setHint])

  if (!role) {
    return (
      <Surface className="flex items-center gap-3 p-2 sm:pl-4">
        <span className="hidden text-sm text-fg-muted sm:inline">Pose ton premier pixel</span>
        <Button variant="primary" onClick={onOpenAuth}>Se connecter pour jouer</Button>
      </Surface>
    )
  }

  if (!isEditMode) {
    return (
      <Surface className="flex h-11 items-center gap-2 px-4 text-sm text-fg-muted">
        <span className="inline-flex [&>svg]:size-4" aria-hidden="true"><EyeIcon /></span>
        Mode spectateur
      </Surface>
    )
  }

  function pick(id: number) {
    if (lockedColors.has(id)) {
      setHint(hint === id ? null : id)
      if (hint !== id) void useUnlocksStore.getState().load()   // progression fraîche
      return
    }
    setHint(null)
    setSelected(selected === id ? null : id)
  }

  return (
    <Surface className="p-2">
      {hint !== null && <LockedColorHint colorId={hint} onClose={() => setHint(null)} />}

      <div role="group" aria-label="Palette de couleurs" className="grid grid-cols-8 gap-1.5 md:grid-cols-16">
        {DEFAULT_COLORS.map((hex, id) => {
          const locked   = lockedColors.has(id)
          const isActive = selected === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={locked ? undefined : isActive}
              aria-expanded={locked ? hint === id : undefined}
              aria-label={locked ? `${COLOR_NAMES[id]}, verrouillée — voir comment la débloquer` : COLOR_NAMES[id]}
              title={locked ? `${COLOR_NAMES[id]} — verrouillée` : COLOR_NAMES[id]}
              onClick={() => pick(id)}
              className={cn(
                'relative grid size-9 place-items-center rounded-md transition-transform duration-150 md:size-8',
                // Double anneau : sombre puis clair, lisible sur les 16 couleurs comme sur le fond
                isActive
                  ? 'z-10 scale-110 shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-fg)]'
                  : 'hover:scale-105',
                locked && hint === id && 'shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-warning)]',
              )}
              style={{ backgroundColor: hex }}
            >
              <span
                aria-hidden="true"
                className={cn('pointer-events-none absolute inset-0 rounded-md', locked && 'bg-surface/60')}
                style={{ boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.14)' }}
              />
              {locked && (
                <span aria-hidden="true" className="relative grid size-5 place-items-center rounded-full bg-bg/80 text-fg [&>svg]:size-3">
                  <LockIcon />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {cooldown.active && (
        <div className="mt-2 flex items-center gap-3 px-1" aria-hidden="true">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-100 ease-linear"
              style={{ width: `${cooldown.progress * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-fg-muted">
            Prochain pixel dans {formatRemaining(cooldown.remainingMs)}
          </span>
        </div>
      )}

      {/* Le compte à rebours n'est pas annoncé seconde par seconde : seule la fin l'est */}
      <span role="status" className="sr-only">{readyAnnouncement}</span>
    </Surface>
  )
}

/** Conditions de déblocage d'une couleur, affichées au-dessus de la palette. */
function LockedColorHint({ colorId, onClose }: { colorId: number; onClose: () => void }) {
  const tree            = useUnlocksStore((s) => s.tree)
  const streak          = useUnlocksStore((s) => s.streak)
  const unlock          = useUnlocksStore((s) => s.unlock)
  const openProgression = useHudStore((s) => s.openProgression)
  const setSelected     = useCanvasStore((s) => s.setSelectedColor)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)
  const node   = colorNode(tree, colorId)
  const status = node ? nodeStatus(node, streak) : 'locked'

  useEffect(() => { setError(null) }, [colorId])

  async function handleUnlock() {
    if (!node) return
    setBusy(true)
    setError(null)
    try {
      await unlock(node.nodeId)
      setSelected(colorId)   // débloquée pour s'en servir : on la prend en main
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Déblocage impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label={`Débloquer le ${COLOR_NAMES[colorId].toLowerCase()}`} className="mb-2 w-0 min-w-full rounded-control bg-surface-2 p-3">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 size-6 shrink-0 rounded-md"
          style={{ backgroundColor: DEFAULT_COLORS[colorId], boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .2)' }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">
            {COLOR_NAMES[colorId]}
            {node?.level && <span className="ml-2 text-xs font-normal text-fg-subtle">Niveau {node.level}</span>}
          </p>
          <p className="text-xs text-fg-muted">
            {status === 'ready'        && 'Tout est prêt : tu peux la débloquer.'}
            {status === 'needs_streak' && 'Conditions remplies — il te manque des heures de streak.'}
            {status === 'locked'       && 'Pour la débloquer :'}
          </p>
        </div>
        <IconButton label="Fermer" icon={<CloseIcon />} size="sm" onClick={onClose} tooltipSide="left" className="-mr-1 -mt-1" />
      </div>

      {node && <div className="mt-2.5"><ConditionList node={node} tree={tree} streak={streak} compact /></div>}

      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => openProgression(node?.nodeId)}>Voir la progression</Button>
        {status === 'ready' && node && (
          <Button size="sm" variant="primary" onClick={handleUnlock} disabled={busy}>
            {busy ? 'Déblocage…' : `Débloquer · ${node.streakCost} h`}
          </Button>
        )}
      </div>
    </section>
  )
}

function useReadyAnnouncement(active: boolean) {
  const wasActive = useRef(active)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (wasActive.current && !active) setMessage('Tu peux poser un nouveau pixel.')
    if (active) setMessage('')
    wasActive.current = active
  }, [active])
  return message
}
