import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { useNotifications, DISMISS_AFTER_MS, MAX_VISIBLE } from '../features/notifications/store'
import {
  overwrittenNotification, unlockNotifications, bannedNotification,
  gridErrorNotification, placementRejectedNotification,
} from '../features/notifications/socketEvents'

const state = () => useNotifications.getState()

beforeEach(() => { vi.useFakeTimers(); state().clear() })
afterEach(() => { state().clear(); vi.useRealTimers() })

describe('store de notifications', () => {
  test('ajoute une notification', () => {
    state().notify({ kind: 'info', message: 'bonjour' })
    expect(state().items).toHaveLength(1)
    expect(state().items[0]).toMatchObject({ kind: 'info', message: 'bonjour', count: 1 })
  })

  test('disparaît seule après le délai de son type', () => {
    state().notify({ kind: 'info', message: 'éphémère' })
    vi.advanceTimersByTime(DISMISS_AFTER_MS.info - 1)
    expect(state().items).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(state().items).toHaveLength(0)
  })

  test('les erreurs restent affichées plus longtemps', () => {
    expect(DISMISS_AFTER_MS.error).toBeGreaterThan(DISMISS_AFTER_MS.info)
  })

  test('une notification persistante ne disparaît pas seule', () => {
    state().notify({ kind: 'error', message: 'banni', persistent: true })
    vi.advanceTimersByTime(60_000)
    expect(state().items).toHaveLength(1)
  })

  test('regroupe les notifications de même clé en une seule', () => {
    for (let i = 0; i < 5; i++) {
      state().notify({ kind: 'info', key: 'k', message: 'unitaire', groupedMessage: (n) => `${n} fois` })
    }
    expect(state().items).toHaveLength(1)
    expect(state().items[0]).toMatchObject({ count: 5, message: '5 fois' })
  })

  test('un regroupement repousse la disparition', () => {
    state().notify({ kind: 'info', key: 'k', message: 'a' })
    vi.advanceTimersByTime(DISMISS_AFTER_MS.info - 100)
    state().notify({ kind: 'info', key: 'k', message: 'b' })
    vi.advanceTimersByTime(200)
    expect(state().items).toHaveLength(1)
  })

  test('limite la pile et évince les plus anciennes', () => {
    for (let i = 0; i < MAX_VISIBLE + 3; i++) state().notify({ kind: 'info', message: `n${i}` })
    expect(state().items).toHaveLength(MAX_VISIBLE)
    expect(state().items[0].message).toBe('n3')
  })

  test('n\'évince jamais une notification persistante', () => {
    state().notify({ kind: 'error', message: 'banni', persistent: true })
    for (let i = 0; i < MAX_VISIBLE + 2; i++) state().notify({ kind: 'info', message: `n${i}` })
    expect(state().items.some(n => n.message === 'banni')).toBe(true)
  })

  test('dismiss retire la notification et annule son minuteur', () => {
    const id = state().notify({ kind: 'info', message: 'x' })
    state().dismiss(id)
    expect(state().items).toHaveLength(0)
    expect(() => vi.runAllTimers()).not.toThrow()
  })
})

describe('événements serveur → notifications', () => {
  test('pixel recouvert : coordonnées dans le repère du HUD, pas celui de la grille', () => {
    // Grille (1036, 984) ↔ affiché (12, 40), comme dans la notch
    const n = overwrittenNotification({ x: 1036, y: 984, by: 'Bob', source: 'web' })
    expect(n.message).toContain('X: 12  Y: 40')
    expect(n.message).not.toContain('1036')
    expect(n.message).toContain('Bob')
  })

  test('pixel recouvert depuis Minecraft : la plateforme est indiquée', () => {
    expect(overwrittenNotification({ x: 1024, y: 1024, by: 'Steve', source: 'minecraft' }).message)
      .toContain('depuis Minecraft')
  })

  test('une rafale de recouvrements produit une seule notification', () => {
    for (let i = 0; i < 12; i++) state().notify(overwrittenNotification({ x: i, y: 0, by: 'Griefer' }))
    expect(state().items).toHaveLength(1)
    expect(state().items[0].message).toBe('12 de tes pixels ont été recouverts.')
  })

  test('chaque déblocage donne une notification de succès', () => {
    const list = unlockNotifications({ unlocks: [{ nodeId: 'color:6', name: 'Orange' }, { nodeId: 'feature:heatmap', name: 'Heatmap' }] })
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ kind: 'success', message: 'Débloqué : Orange' })
  })

  test('tolère un événement de déblocage vide', () => {
    expect(unlockNotifications({} as never)).toEqual([])
  })

  test('le bannissement est une erreur persistante', () => {
    expect(bannedNotification({ reason: 'spam' })).toMatchObject({ kind: 'error', persistent: true, message: 'Tu as été banni : spam' })
    expect(bannedNotification().message).toBe('Tu as été banni.')
  })

  test('grille indisponible', () => {
    expect(gridErrorNotification({}).kind).toBe('error')
  })

  test('les refus de pose répétés ne s\'empilent pas', () => {
    for (let i = 0; i < 8; i++) state().notify(placementRejectedNotification(`Trop vite ! Attends ${60 - i}s.`))
    expect(state().items).toHaveLength(1)
    expect(state().items[0].message).toBe('Trop vite ! Attends 53s.')
  })
})
