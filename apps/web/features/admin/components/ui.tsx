import { Children, type ReactNode } from 'react'
import { cn } from '@shared/ui'
import type { Role } from '../api'

/** Carte de section du tableau de bord. */
export function Panel({ title, description, actions, children, tone = 'default', className }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode
  tone?: 'default' | 'danger'; className?: string
}) {
  const hasBody = Children.toArray(children).length > 0
  return (
    <section className={cn('rounded-panel border bg-surface p-4 sm:p-5', tone === 'danger' ? 'border-danger/40' : 'border-line', className)}>
      {(title || actions) && (
        <header className={cn('flex flex-wrap items-start justify-between gap-3', hasBody && 'mb-4')}>
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-1 rounded-control bg-bg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 rounded-md px-3 text-sm font-medium transition-colors',
            value === o.value ? 'bg-surface-2 text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const ROLE_LABELS: Record<Role, { label: string; className: string }> = {
  user:       { label: 'Joueur',         className: 'bg-surface-2 text-fg-muted' },
  superuser:  { label: 'Superuser',      className: 'bg-warning/15 text-warning' },
  admin:      { label: 'Modérateur',     className: 'bg-accent/15 text-accent' },
  superadmin: { label: 'Administrateur', className: 'bg-danger/15 text-danger' },
}

export function RoleBadge({ role }: { role: Role }) {
  const r = ROLE_LABELS[role] ?? ROLE_LABELS.user
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', r.className)}>{r.label}</span>
}

export function LoadingLine() {
  return <p role="status" className="py-8 text-center text-sm text-fg-muted">Chargement…</p>
}

export function ErrorLine({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-danger/10 p-3 text-sm text-danger">
      {message}
      <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">Réessayer</button>
    </div>
  )
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-fg-muted">{children}</p>
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
export const formatDate = (date: string | number | Date) => dateFormat.format(new Date(date))

/** Retour d'une action. Toujours monté : une région live vide annonce ce qu'on y écrit ensuite. */
export function Notice({ message }: { message: string | null }) {
  return (
    <p role="status" className={message ? 'mb-3 rounded-control bg-surface-2 px-3 py-2 text-sm text-fg-muted' : 'sr-only'}>
      {message}
    </p>
  )
}
