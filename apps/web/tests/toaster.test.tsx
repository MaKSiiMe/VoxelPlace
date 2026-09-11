// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from '../features/notifications/components/Toaster'
import { useNotifications } from '../features/notifications/store'

const notify = (...args: Parameters<ReturnType<typeof useNotifications.getState>['notify']>) =>
  act(() => { useNotifications.getState().notify(...args) })

beforeEach(() => useNotifications.getState().clear())
afterEach(() => { cleanup(); useNotifications.getState().clear() })

describe('<Toaster />', () => {
  test('la zone live existe avant toute notification', () => {
    // Un lecteur d'écran n'annonce pas le contenu d'une zone live créée en même temps que lui
    render(<Toaster />)
    const region = screen.getByRole('region', { name: 'Notifications' })
    expect(region.getAttribute('aria-live')).toBe('polite')
  })

  test('affiche une information comme statut', () => {
    render(<Toaster />)
    notify({ kind: 'info', message: 'Ton pixel a été recouvert.' })
    expect(screen.getByRole('status').textContent).toContain('Ton pixel a été recouvert.')
  })

  test('affiche une erreur comme alerte, annoncée immédiatement', () => {
    render(<Toaster />)
    notify({ kind: 'error', message: 'Tu as été banni.' })
    expect(screen.getByRole('alert').textContent).toContain('Tu as été banni.')
  })

  test('annonce la nature de la notification aux lecteurs d\'écran', () => {
    render(<Toaster />)
    notify({ kind: 'success', message: 'Débloqué : Orange' })
    expect(screen.getByRole('status').textContent).toContain('Succès')
  })

  test('affiche le compteur d\'un regroupement', () => {
    render(<Toaster />)
    notify({ kind: 'info', key: 'k', message: 'a' })
    notify({ kind: 'info', key: 'k', message: 'b' })
    expect(screen.getByLabelText('2 occurrences')).toBeTruthy()
  })

  test('se ferme au clic sur le bouton étiqueté', async () => {
    render(<Toaster />)
    notify({ kind: 'info', message: 'à fermer' })
    await userEvent.click(screen.getByRole('button', { name: 'Fermer la notification' }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
