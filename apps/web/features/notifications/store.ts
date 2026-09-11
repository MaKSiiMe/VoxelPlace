'use client'

import { create } from 'zustand'

export type NotificationKind = 'info' | 'success' | 'error'

export interface Notification {
  id:        number
  kind:      NotificationKind
  message:   string
  /** Nombre d'occurrences regroupées sous la même clé. */
  count:     number
  /** Clé de regroupement : une nouvelle notification de même clé remplace la précédente. */
  key?:      string
  /** Reste affichée jusqu'à fermeture manuelle. */
  persistent: boolean
}

export interface NotifyInput {
  kind:        NotificationKind
  message:     string
  key?:        string
  persistent?: boolean
  /**
   * Message à afficher lorsque plusieurs occurrences sont regroupées.
   * Reçoit le nombre total d'occurrences.
   */
  groupedMessage?: (count: number) => string
}

/** Durée d'affichage par défaut. Les erreurs restent plus longtemps. */
export const DISMISS_AFTER_MS: Record<NotificationKind, number> = {
  info:    5_000,
  success: 5_000,
  error:   8_000,
}

/** Au-delà, les plus anciennes disparaissent : la pile ne doit pas couvrir le canvas. */
export const MAX_VISIBLE = 4

interface NotificationState {
  items:   Notification[]
  notify:  (input: NotifyInput) => number
  dismiss: (id: number) => void
  clear:   () => void
}

let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function schedule(id: number, kind: NotificationKind, persistent: boolean, dismiss: (id: number) => void) {
  clearTimeout(timers.get(id))
  if (persistent) return
  timers.set(id, setTimeout(() => dismiss(id), DISMISS_AFTER_MS[kind]))
}

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],

  notify: ({ kind, message, key, persistent = false, groupedMessage }) => {
    const { items, dismiss } = get()

    // Regroupement : une rafale d'événements de même nature ne doit produire
    // qu'une seule notification, dont le compteur et le texte se mettent à jour.
    const existing = key ? items.find(n => n.key === key) : undefined
    if (existing) {
      const count = existing.count + 1
      const updated: Notification = {
        ...existing,
        kind,
        count,
        message: groupedMessage ? groupedMessage(count) : message,
      }
      set({ items: items.map(n => (n.id === existing.id ? updated : n)) })
      schedule(existing.id, kind, persistent, dismiss)
      return existing.id
    }

    const id = nextId++
    const next = [...items, { id, kind, message, key, count: 1, persistent }]
    // Les notifications persistantes ne sont jamais évincées par la limite
    while (next.length > MAX_VISIBLE) {
      const evictable = next.findIndex(n => !n.persistent)
      if (evictable === -1) break
      clearTimeout(timers.get(next[evictable].id))
      next.splice(evictable, 1)
    }
    set({ items: next })
    schedule(id, kind, persistent, dismiss)
    return id
  },

  dismiss: (id) => {
    clearTimeout(timers.get(id))
    timers.delete(id)
    set({ items: get().items.filter(n => n.id !== id) })
  },

  clear: () => {
    for (const t of timers.values()) clearTimeout(t)
    timers.clear()
    set({ items: [] })
  },
}))

/** Raccourci utilisable hors composants React (stores, handlers de socket). */
export const notify = (input: NotifyInput) => useNotifications.getState().notify(input)
