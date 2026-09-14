import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

interface IconLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
  label: string
  icon:  ReactNode
}

/** Lien en forme de bouton icône — pour une navigation, un <a> et non un <button>. */
export function IconLink({ label, icon, className, ...props }: IconLinkProps) {
  return (
    <span className="group relative inline-flex">
      <a
        aria-label={label}
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-control text-fg-muted',
          'transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" className="inline-flex [&>svg]:size-[18px]">{icon}</span>
      </a>
      <span role="presentation" className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-surface-2 px-2 py-1 text-xs text-fg opacity-0 shadow-float transition-opacity duration-150 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">
        {label}
      </span>
    </span>
  )
}
