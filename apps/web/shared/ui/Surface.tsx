import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/** Panneau flottant posé sur le canvas : barres d'outils, palette, minimap. */
export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-panel bg-surface/90 shadow-float backdrop-blur-md', className)}
      {...props}
    />
  )
}
