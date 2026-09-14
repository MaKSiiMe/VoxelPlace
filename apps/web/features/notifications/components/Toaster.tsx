'use client'

import { useNotifications, type NotificationKind } from '../store'
import { CloseIcon, cn } from '@shared/ui'

const ACCENT: Record<NotificationKind, string> = {
  info:    'bg-accent',
  success: 'bg-success',
  error:   'bg-danger',
}

const COUNT: Record<NotificationKind, string> = {
  info:    'text-accent',
  success: 'text-success',
  error:   'text-danger',
}

const LABEL: Record<NotificationKind, string> = {
  info:    'Information',
  success: 'Succès',
  error:   'Erreur',
}

/**
 * Pile de notifications.
 *
 * Accessibilité : le conteneur est une zone live « polite », présente dans le
 * DOM avant toute notification — un lecteur d'écran n'annonce pas le contenu
 * inséré dans une zone live créée au même moment. Les erreurs portent en plus
 * role="alert", annoncé immédiatement.
 */
export function Toaster() {
  const items   = useNotifications((s) => s.items)
  const dismiss = useNotifications((s) => s.dismiss)

  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      // Sous la rangée du haut sur mobile (occupée par la barre d'outils), en haut à droite ailleurs
      className="pointer-events-none fixed inset-x-3 top-[72px] z-40 flex flex-col gap-2 md:inset-x-auto md:right-3 md:top-3 md:w-[340px]"
    >
      {items.map((n) => (
        <div
          key={n.id}
          role={n.kind === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-panel bg-surface py-3 pl-4 pr-3 shadow-float"
        >
          <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', ACCENT[n.kind])} />
          <span className="sr-only">{LABEL[n.kind]} : </span>
          <span className="flex-1 text-sm leading-snug text-fg">{n.message}</span>
          {n.count > 1 && (
            <span aria-label={`${n.count} occurrences`} className={cn('shrink-0 font-mono text-xs font-semibold', COUNT[n.kind])}>
              ×{n.count}
            </span>
          )}
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            aria-label="Fermer la notification"
            className="-m-1 shrink-0 rounded-md p-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <span aria-hidden="true" className="inline-flex [&>svg]:size-4"><CloseIcon /></span>
          </button>
        </div>
      ))}
    </section>
  )
}
