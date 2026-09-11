import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

const TOOLTIP_POSITION: Record<TooltipSide, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Obligatoire : c'est le seul nom accessible d'un bouton sans texte. */
  label:        string
  icon:         ReactNode
  /** État d'un bouton bascule (panneau ouvert, mode actif). */
  pressed?:     boolean
  tooltipSide?: TooltipSide
  /** Raccourci clavier affiché dans l'infobulle. */
  shortcut?:    string
  size?:        'sm' | 'md'
}

/**
 * Bouton icône avec infobulle.
 *
 * L'infobulle apparaît au survol et au focus clavier : les boutons du dock
 * existant n'avaient qu'un attribut title, invisible au clavier et sur mobile.
 */
export function IconButton({
  label, icon, pressed, tooltipSide = 'right', shortcut, size = 'md', className, type = 'button', ...props
}: IconButtonProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          'inline-flex items-center justify-center rounded-control transition-colors duration-150',
          size === 'md' ? 'size-10' : 'size-8',
          pressed
            ? 'bg-accent/15 text-accent'
            : 'text-fg-muted hover:text-fg hover:bg-surface-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" className="inline-flex [&>svg]:size-[18px]">{icon}</span>
      </button>
      <span
        role="presentation"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-surface-2 px-2 py-1',
          'text-xs text-fg shadow-float opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-has-[:focus-visible]:opacity-100',
          TOOLTIP_POSITION[tooltipSide],
        )}
      >
        {label}
        {shortcut && <kbd className="ml-2 font-mono text-[10px] text-fg-subtle">{shortcut}</kbd>}
      </span>
    </span>
  )
}
