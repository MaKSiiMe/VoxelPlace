'use client'

import { useEffect, useRef, useState } from 'react'
import { useCanvasStore, DEFAULT_COLORS, COLOR_NAMES } from '@features/canvas/store'
import { useCooldown, formatRemaining } from '../cooldown'
import { Button, Surface, cn, EyeIcon } from '@shared/ui'

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
 */
export function PaletteDock({ onOpenAuth, lockedColors = new Set() }: Props) {
  const role        = useCanvasStore((s) => s.role)
  const selected    = useCanvasStore((s) => s.selectedColor)
  const isEditMode  = useCanvasStore((s) => s.isEditMode)
  const setSelected = useCanvasStore((s) => s.setSelectedColor)
  const cooldown    = useCooldown()
  const readyAnnouncement = useReadyAnnouncement(cooldown.active)

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

  return (
    <Surface className="p-2">
      <div role="group" aria-label="Palette de couleurs" className="grid grid-cols-8 gap-1.5 md:grid-cols-16">
        {DEFAULT_COLORS.map((hex, id) => {
          const locked   = lockedColors.has(id)
          const isActive = selected === id
          return (
            <button
              key={id}
              type="button"
              disabled={locked}
              aria-pressed={isActive}
              aria-label={locked ? `${COLOR_NAMES[id]}, verrouillée` : COLOR_NAMES[id]}
              title={locked ? `${COLOR_NAMES[id]} — à débloquer dans la progression` : COLOR_NAMES[id]}
              onClick={() => setSelected(isActive ? null : id)}
              className={cn(
                'relative size-9 rounded-md transition-transform duration-150 md:size-8',
                'ring-offset-2 ring-offset-surface',
                isActive ? 'scale-110 ring-2 ring-fg' : 'enabled:hover:scale-105',
                locked && 'cursor-not-allowed opacity-30',
              )}
              style={{ backgroundColor: hex, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.14)' }}
            />
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
