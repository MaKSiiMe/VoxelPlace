'use client'

import { useNotifications, type NotificationKind } from '../store'
import { BEZEL_COLOR, BORDER_COLOR, ACCENT_BLUE, ACCENT_GREEN, ACCENT_RED, MUTED_TEXT, TEXT_COLOR } from '@features/hud/theme'

const ACCENT: Record<NotificationKind, string> = {
  info:    ACCENT_BLUE,
  success: ACCENT_GREEN,
  error:   ACCENT_RED,
}

const LABEL: Record<NotificationKind, string> = {
  info:    'Information',
  success: 'Succès',
  error:   'Erreur',
}

/**
 * Pile de notifications, en haut à droite, à l'intérieur du bezel.
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
          style={{
            pointerEvents: 'auto',
            display:       'flex',
            alignItems:    'flex-start',
            gap:           10,
            background:    BEZEL_COLOR,
            border:        `1px solid ${BORDER_COLOR}`,
            borderLeft:    `3px solid ${ACCENT[n.kind]}`,
            borderRadius:  8,
            padding:       '10px 12px',
            boxShadow:     '0 4px 24px rgba(0,0,0,0.6)',
            fontFamily:    'monospace',
          }}
        >
          <span className="sr-only">{LABEL[n.kind]} : </span>
          <span style={{ flex: 1, color: TEXT_COLOR, fontSize: 12, lineHeight: 1.5 }}>
            {n.message}
          </span>
          {n.count > 1 && (
            <span
              aria-label={`${n.count} occurrences`}
              style={{ color: ACCENT[n.kind], fontSize: 11, fontWeight: 700, flexShrink: 0 }}
            >
              ×{n.count}
            </span>
          )}
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            aria-label="Fermer la notification"
            style={{
              background: 'transparent',
              border:     'none',
              color:      MUTED_TEXT,
              cursor:     'pointer',
              fontSize:   14,
              lineHeight: 1,
              padding:    0,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT_RED)}
            onMouseLeave={(e) => (e.currentTarget.style.color = MUTED_TEXT)}
          >
            ✕
          </button>
        </div>
      ))}
    </section>
  )
}
