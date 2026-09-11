// ── Événements serveur → notifications ───────────────────────────────────────
// Fonctions pures : chaque événement Socket.io devient une demande de
// notification. Le serveur émettait ces événements depuis le début, mais le
// client n'en écoutait aucun.

import type { NotifyInput } from './store'
import { formatDisplayCoords } from '@features/canvas/coords'

export interface OverwrittenPayload { x: number; y: number; by: string; source?: string }
export interface UnlocksPayload     { unlocks: { nodeId: string; name: string }[] }
export interface BannedPayload      { reason?: string }
export interface GridErrorPayload   { message?: string }

const SOURCE_LABELS: Record<string, string> = { minecraft: 'Minecraft', web: 'le web' }

export function overwrittenNotification({ x, y, by, source }: OverwrittenPayload): NotifyInput {
  const from = source && source !== 'web' ? ` depuis ${SOURCE_LABELS[source] ?? source}` : ''
  return {
    kind:    'info',
    key:     'pixel:overwritten',
    message: `Ton pixel (${formatDisplayCoords(x, y)}) a été recouvert par ${by}${from}.`,
    // Un recouvrement massif ne doit pas empiler une notification par pixel
    groupedMessage: (count) => `${count} de tes pixels ont été recouverts.`,
  }
}

export function unlockNotifications({ unlocks }: UnlocksPayload): NotifyInput[] {
  return (unlocks ?? []).map(({ name }) => ({
    kind:    'success' as const,
    message: `Débloqué : ${name}`,
  }))
}

export function bannedNotification({ reason }: BannedPayload = {}): NotifyInput {
  return {
    kind:       'error',
    key:        'banned',
    persistent: true,
    message:    reason ? `Tu as été banni : ${reason}` : 'Tu as été banni.',
  }
}

export function gridErrorNotification({ message }: GridErrorPayload = {}): NotifyInput {
  return {
    kind:    'error',
    key:     'grid:error',
    message: message ?? 'Le canvas est temporairement indisponible.',
  }
}

/** Refus de pose renvoyé par le serveur dans l'acquittement de pixel:place. */
export function placementRejectedNotification(error: string): NotifyInput {
  return {
    kind:    'error',
    // Même clé pour tous les refus : cliquer frénétiquement pendant le
    // cooldown met à jour une seule notification au lieu d'en empiler.
    key:     'pixel:rejected',
    message: error,
  }
}
