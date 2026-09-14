// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@features/realtime/socket', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))

import { AuthDialog } from '../features/auth/components/AuthDialog'
import { HelpDialog } from '../features/hud/components/HelpDialog'
import { SettingsDialog } from '../features/hud/components/SettingsDialog'
import { useCanvasStore } from '../features/canvas/store'
import { ROLE_COOLDOWNS, STREAK_COOLDOWNS } from '@voxelplace/types'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const respond = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })

describe('<AuthDialog />', () => {
  const setup = (props: Partial<Parameters<typeof AuthDialog>[0]> = {}) => {
    const onClose = vi.fn(), onSuccess = vi.fn()
    render(<AuthDialog open onClose={onClose} onSuccess={onSuccess} {...props} />)
    return { onClose, onSuccess }
  }

  test('se ferme — l\'ancienne fenêtre ne le permettait pas', async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('Échap la ferme aussi', () => {
    const { onClose } = setup()
    fireEvent(document.querySelector('dialog')!, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('onglets accessibles : sélection au clic et aux flèches', async () => {
    setup()
    const login = screen.getByRole('tab', { name: 'Connexion' })
    const register = screen.getByRole('tab', { name: 'Inscription' })
    expect(login.getAttribute('aria-selected')).toBe('true')

    await userEvent.click(register)
    expect(register.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(register.id)

    fireEvent.keyDown(register, { key: 'ArrowLeft' })
    expect(login.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(login)
  })

  test('connecte et transmet la réponse', async () => {
    respond(200, { token: 't', username: 'Alice', role: 'user' })
    const { onSuccess } = setup()
    await userEvent.type(screen.getByLabelText('Pseudo'), 'Alice')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'motdepasse')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(onSuccess).toHaveBeenCalledWith({ token: 't', username: 'Alice', role: 'user' })
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/login$/)
  })

  test('crée un compte depuis l\'onglet Inscription', async () => {
    respond(201, { token: 't', username: 'Bob', role: 'user' })
    const { onSuccess } = setup()
    await userEvent.click(screen.getByRole('tab', { name: 'Inscription' }))
    await userEvent.type(screen.getByLabelText('Pseudo'), 'Bob')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'motdepasse')
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/register$/)
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  test('affiche l\'erreur du serveur comme alerte', async () => {
    respond(401, { error: 'Identifiants incorrects' })
    const { onSuccess } = setup()
    await userEvent.type(screen.getByLabelText('Pseudo'), 'Alice')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'mauvais1')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Identifiants incorrects')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test('n\'annonce plus aucun privilège lié au pseudo', async () => {
    setup()
    await userEvent.click(screen.getByRole('tab', { name: 'Inscription' }))
    expect(document.body.textContent).not.toMatch(/hbtn|superuser/i)
  })
})

describe('<HelpDialog />', () => {
  test('affiche les durées de cooldown réellement appliquées par le serveur', () => {
    render(<HelpDialog open onClose={() => {}} />)
    const text = document.body.textContent ?? ''
    expect(text).toContain(`${ROLE_COOLDOWNS.user / 1000} s`)
    for (const step of STREAK_COOLDOWNS) {
      expect(text).toContain(`${step.ms / 1000} s`)
      expect(text).toContain(`dès ${step.minHours} h de streak`)
    }
  })

  test('présente les contrôles souris et tactiles', () => {
    render(<HelpDialog open onClose={() => {}} />)
    expect(screen.getByText('Pincer')).toBeTruthy()
    expect(screen.getByText('Molette')).toBeTruthy()
  })
})

describe('<SettingsDialog />', () => {
  test('propose la connexion à un visiteur', async () => {
    useCanvasStore.setState({ role: null })
    const onOpenAuth = vi.fn(), onClose = vi.fn()
    render(<SettingsDialog open onClose={onClose} username="viewer_ab12" onLogout={() => {}} onOpenAuth={onOpenAuth} />)
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter pour jouer' }))
    expect(onClose).toHaveBeenCalled()
    expect(onOpenAuth).toHaveBeenCalled()
  })

  test('affiche le rôle en français et permet de se déconnecter', async () => {
    useCanvasStore.setState({ role: 'admin' })
    const onLogout = vi.fn()
    render(<SettingsDialog open onClose={() => {}} username="Maxime" onLogout={onLogout} onOpenAuth={() => {}} />)
    expect(screen.getByText('Modérateur')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Se déconnecter/ }))
    expect(onLogout).toHaveBeenCalledOnce()
  })
})
