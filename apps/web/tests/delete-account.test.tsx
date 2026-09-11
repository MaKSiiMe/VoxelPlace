// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@features/realtime/socket', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))

import { DeleteAccountSection } from '../features/auth/components/DeleteAccountSection'
import { apiDeleteAccount } from '../features/auth/api'
import { useAuthStore } from '../features/auth/store'
import { useNotifications } from '../features/notifications/store'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  localStorage.clear()
  useAuthStore.setState({ username: 'Alice', token: 'jeton-alice', role: 'user' })
  useNotifications.getState().clear()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const respond = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })

describe('apiDeleteAccount', () => {
  test('envoie le mot de passe en DELETE, avec le jeton', async () => {
    respond(200, { ok: true })
    await apiDeleteAccount('jeton', 'secret')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/auth\/account$/)
    expect(init.method).toBe('DELETE')
    expect(init.headers.Authorization).toBe('Bearer jeton')
    expect(JSON.parse(init.body)).toEqual({ password: 'secret' })
  })

  test('relaie le message d\'erreur du serveur', async () => {
    respond(401, { error: 'Mot de passe incorrect' })
    await expect(apiDeleteAccount('jeton', 'faux')).rejects.toThrow('Mot de passe incorrect')
  })
})

describe('<DeleteAccountSection />', () => {
  test('n\'expose d\'abord qu\'un lien discret, sans supprimer quoi que ce soit', () => {
    render(<DeleteAccountSection onDeleted={() => {}} />)
    expect(screen.getByRole('button', { name: 'Supprimer mon compte…' })).toBeTruthy()
    expect(screen.queryByLabelText('Confirme avec ton mot de passe')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('explique ce qui est effacé et ce qui reste', async () => {
    render(<DeleteAccountSection onDeleted={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte…' }))
    expect(document.body.textContent).toContain('Tes pixels restent sur le canvas, mais ne portent plus ton pseudo.')
    expect(document.body.textContent).toContain('irréversible')
  })

  test('place le focus sur le mot de passe à l\'ouverture', async () => {
    render(<DeleteAccountSection onDeleted={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte…' }))
    expect(document.activeElement).toBe(screen.getByLabelText('Confirme avec ton mot de passe'))
  })

  test('garde la suppression désactivée tant que le mot de passe est vide', async () => {
    render(<DeleteAccountSection onDeleted={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte…' }))
    expect((screen.getByRole('button', { name: 'Supprimer' }) as HTMLButtonElement).disabled).toBe(true)
  })

  test('supprime, déconnecte et prévient le joueur', async () => {
    respond(200, { ok: true })
    const onDeleted = vi.fn()
    render(<DeleteAccountSection onDeleted={onDeleted} />)

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte…' }))
    await userEvent.type(screen.getByLabelText('Confirme avec ton mot de passe'), 'motdepasse')
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(onDeleted).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().token).toBeNull()
    expect(useNotifications.getState().items[0]).toMatchObject({ kind: 'success', message: 'Ton compte a été supprimé.' })
  })

  test('affiche l\'erreur et ne déconnecte pas en cas d\'échec', async () => {
    respond(401, { error: 'Mot de passe incorrect' })
    const onDeleted = vi.fn()
    render(<DeleteAccountSection onDeleted={onDeleted} />)

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte…' }))
    await userEvent.type(screen.getByLabelText('Confirme avec ton mot de passe'), 'mauvais')
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(screen.getByRole('alert').textContent).toBe('Mot de passe incorrect')
    expect(onDeleted).not.toHaveBeenCalled()
    expect(useAuthStore.getState().token).toBe('jeton-alice')
  })

  test('Échap annule la confirmation', async () => {
    render(<DeleteAccountSection onDeleted={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte…' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByLabelText('Confirme avec ton mot de passe')).toBeNull()
  })

  test('Entrée dans le champ valide le formulaire', async () => {
    respond(200, { ok: true })
    const onDeleted = vi.fn()
    render(<DeleteAccountSection onDeleted={onDeleted} />)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte…' }))
    await userEvent.type(screen.getByLabelText('Confirme avec ton mot de passe'), 'motdepasse{Enter}')
    expect(onDeleted).toHaveBeenCalledOnce()
  })
})
