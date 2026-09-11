'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './IconButton'
import { cn } from './cn'
import { CloseIcon } from './icons'

export interface DialogProps {
  open:         boolean
  onClose:      () => void
  title:        ReactNode
  description?: ReactNode
  children:     ReactNode
  /** Largeur maximale du panneau. */
  size?:        'sm' | 'md' | 'lg'
  className?:   string
}

const WIDTH = { sm: 'w-[min(400px,calc(100vw-24px))]', md: 'w-[min(520px,calc(100vw-24px))]', lg: 'w-[min(760px,calc(100vw-24px))]' }

/**
 * Fenêtre modale fondée sur l'élément <dialog> natif.
 *
 * showModal() fournit ce que les modales existantes n'avaient pas : le focus
 * reste piégé dans la fenêtre, Échap la ferme, le reste de la page devient
 * inerte pour les lecteurs d'écran, et le focus revient à l'élément d'origine
 * à la fermeture.
 */
export function Dialog({ open, onClose, title, description, children, size = 'md', className }: DialogProps) {
  const ref     = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId  = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      // Échap : le navigateur fermerait la fenêtre sans prévenir React
      onCancel={(e) => { e.preventDefault(); onClose() }}
      // Un clic sur le fond (hors du panneau) atteint l'élément <dialog> lui-même
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className={cn(
        'm-auto max-h-[calc(100dvh-24px)] overflow-visible bg-transparent p-0 text-fg',
        'backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        WIDTH[size],
      )}
    >
      <div className={cn('flex max-h-[calc(100dvh-24px)] flex-col rounded-panel bg-surface shadow-float', className)}>
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-fg">{title}</h2>
            {description && <p id={descId} className="mt-1 text-sm text-fg-muted">{description}</p>}
          </div>
          <IconButton label="Fermer" icon={<CloseIcon />} onClick={onClose} size="sm" tooltipSide="left" className="-mr-2 -mt-1" />
        </header>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </dialog>
  )
}
