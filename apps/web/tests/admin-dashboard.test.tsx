// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { getAdminSession, clearAdminToken, ADMIN_TOKEN_KEY, PLAYER_TOKEN_KEY, type AdminSession } from '../features/admin/session'
import { AdminGuard } from '../features/admin/guards/AdminGuard'
import { ReportsSection } from '../features/admin/components/ReportsSection'
import { PlayersSection } from '../features/admin/components/PlayersSection'
import { CanvasSection, parseDisplayInput } from '../features/admin/components/CanvasSection'
import { BanDialog } from '../features/admin/components/BanDialog'
import { fillLast24h, niceMax } from '../features/admin/components/ActivityChart'
import { describeLog } from '../features/admin/components/LogsSection'

const jwt = (payload: object) => `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...payload }))}.s`
const superadmin: AdminSession = { token: jwt({ role: 'superadmin' }), role: 'superadmin', username: null }
const moderator:  AdminSession = { token: jwt({ role: 'admin', username: 'Modo' }), role: 'admin', username: 'Modo' }

type Handler = (body: unknown, url: string) => unknown
let routes: Record<string, Handler>
const calls: { method: string; url: string; body: unknown }[] = []
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET'
  const body = init?.body ? JSON.parse(String(init.body)) : undefined
  calls.push({ method, url, body })
  const key = Object.keys(routes).find((k) => { const [m, path] = k.split(' '); return m === method && url.includes(path) })
  if (!key) return { ok: false, status: 404, json: async () => ({ error: `non simulé : ${method} ${url}` }) } as Response
  const result = routes[key](body, url) as { __status?: number }
  const status = result?.__status ?? 200
  return { ok: status < 400, status, json: async () => result } as Response
})

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  calls.length = 0
  routes = {}
  localStorage.clear()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// ── Session ──────────────────────────────────────────────────────────────────

describe('session d\'administration', () => {
  test('le jeton du mot de passe prime, et ne touche pas à la session de jeu', () => {
    localStorage.setItem(PLAYER_TOKEN_KEY, jwt({ role: 'admin', username: 'Modo' }))
    localStorage.setItem(ADMIN_TOKEN_KEY, jwt({ role: 'superadmin' }))
    expect(getAdminSession()).toMatchObject({ role: 'superadmin', username: null })

    clearAdminToken()
    expect(getAdminSession()).toMatchObject({ role: 'admin', username: 'Modo' })
    expect(localStorage.getItem(PLAYER_TOKEN_KEY)).not.toBeNull()
  })

  test('refuse un joueur ordinaire et un jeton expiré', () => {
    localStorage.setItem(PLAYER_TOKEN_KEY, jwt({ role: 'user', username: 'Alice' }))
    expect(getAdminSession()).toBeNull()
    localStorage.setItem(ADMIN_TOKEN_KEY, jwt({ role: 'superadmin', exp: 1 }))
    expect(getAdminSession()).toBeNull()
  })
})

describe('<AdminGuard />', () => {
  const Child = (s: AdminSession) => <p>connecté en {s.role}</p>

  test('range le jeton du mot de passe à part, sans déconnecter le joueur', async () => {
    const playerToken = jwt({ role: 'user', username: 'Alice' })
    localStorage.setItem(PLAYER_TOKEN_KEY, playerToken)
    const token = jwt({ role: 'superadmin' })
    routes['POST /api/admin/login'] = () => ({ token })

    render(<AdminGuard>{Child}</AdminGuard>)
    await userEvent.type(await screen.findByLabelText('Mot de passe d’administration'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('connecté en superadmin')).toBeTruthy()
    expect(localStorage.getItem(ADMIN_TOKEN_KEY)).toBe(token)
    expect(localStorage.getItem(PLAYER_TOKEN_KEY)).toBe(playerToken)
  })

  test('laisse passer un compte modérateur déjà connecté au jeu', async () => {
    localStorage.setItem(PLAYER_TOKEN_KEY, jwt({ role: 'admin', username: 'Modo' }))
    render(<AdminGuard>{Child}</AdminGuard>)
    expect(await screen.findByText('connecté en admin')).toBeTruthy()
  })

  test('affiche l\'erreur d\'un mauvais mot de passe', async () => {
    routes['POST /api/admin/login'] = () => ({ __status: 401, error: 'Mot de passe incorrect' })
    render(<AdminGuard>{Child}</AdminGuard>)
    await userEvent.type(await screen.findByLabelText('Mot de passe d’administration'), 'faux')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Mot de passe incorrect')
  })
})

// ── Signalements ─────────────────────────────────────────────────────────────

const pixelReport = {
  id: 7, reporter: 'Bob', target_type: 'pixel', target_username: 'Troll', x: 1012, y: 984,
  reason: 'insulte', status: 'pending', reviewed_by: null, reviewed_at: null, created_at: new Date().toISOString(),
}

describe('<ReportsSection />', () => {
  beforeEach(() => {
    localStorage.setItem(ADMIN_TOKEN_KEY, superadmin.token)
    routes['GET /api/admin/reports'] = () => ({ reports: [pixelReport] })
  })

  test('mène au pixel signalé, dans le repère du HUD', async () => {
    render(<ReportsSection />)
    const card = await screen.findByRole('article', { name: 'Signalement 7' })
    expect(card.textContent).toContain('X: -12  Y: 40')
    expect(within(card).getByRole('link', { name: /Voir sur la toile/ }).getAttribute('href')).toBe('/?x=-12&y=40')
  })

  test('efface le pixel après confirmation, en coordonnées de grille', async () => {
    routes['POST /api/admin/pixel/clear'] = () => ({ ok: true, previousOwner: 'Troll' })
    render(<ReportsSection />)
    await userEvent.click(await screen.findByRole('button', { name: 'Effacer le pixel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Effacer' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/api/admin/pixel/clear'))).toBe(true))
    expect(calls.find((c) => c.url.endsWith('/api/admin/pixel/clear'))!.body).toEqual({ x: 1012, y: 984 })
    expect(await screen.findByText('Pixel effacé (il appartenait à Troll).')).toBeTruthy()
  })

  test('marque traité puis recharge la file', async () => {
    routes['PATCH /api/admin/reports/7'] = () => ({ ok: true })
    const onChanged = vi.fn()
    render(<ReportsSection onChanged={onChanged} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Marquer traité' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(calls.filter((c) => c.url.includes('/api/admin/reports?status=pending')).length).toBeGreaterThanOrEqual(2)
  })
})

// ── Bannissement ─────────────────────────────────────────────────────────────

describe('<BanDialog />', () => {
  beforeEach(() => {
    localStorage.setItem(ADMIN_TOKEN_KEY, superadmin.token)
    routes['POST /api/admin/ban/'] = () => ({ ok: true })
  })

  test('envoie motif et durée ; « Définitif » n\'envoie pas de durée', async () => {
    const onBanned = vi.fn()
    render(<BanDialog open username="Troll" onClose={() => {}} onBanned={onBanned} />)
    await userEvent.type(screen.getByLabelText('Motif'), 'insultes')
    await userEvent.click(screen.getByLabelText('Définitif'))
    await userEvent.click(screen.getByRole('button', { name: 'Bannir' }))

    await waitFor(() => expect(onBanned).toHaveBeenCalledWith('Troll'))
    expect(calls[0].method).toBe('POST')
    expect(calls[0].body).toEqual({ reason: 'insultes' })   // sans expires_in_days : définitif
    expect(calls[0].url).toContain('/api/admin/ban/Troll')
  })

  test('7 jours par défaut', async () => {
    render(<BanDialog open username="Troll" onClose={() => {}} onBanned={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Bannir' }))
    await waitFor(() => expect(calls[0]?.body).toEqual({ expires_in_days: 7 }))
  })

  test('affiche le refus du serveur', async () => {
    routes['POST /api/admin/ban/'] = () => ({ __status: 400, error: 'Pseudo invalide' })
    render(<BanDialog open onClose={() => {}} onBanned={() => {}} />)
    await userEvent.type(screen.getByLabelText('Pseudo'), '<>')
    await userEvent.click(screen.getByRole('button', { name: 'Bannir' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Pseudo invalide')
  })
})

// ── Joueurs et rôles ─────────────────────────────────────────────────────────

describe('<PlayersSection />', () => {
  beforeEach(() => {
    localStorage.setItem(ADMIN_TOKEN_KEY, superadmin.token)
    routes['GET /api/admin/users'] = () => ({ users: [{ username: 'Alice', role: 'user', created_at: new Date().toISOString(), banned: false, ban_reason: null, ban_expires_at: null }] })
    routes['GET /api/admin/bans'] = () => ({ bans: [] })
  })

  test('un administrateur accorde un rôle', async () => {
    routes['PATCH /api/admin/users/Alice/role'] = () => ({ ok: true })
    render(<PlayersSection session={superadmin} />)
    await userEvent.selectOptions(await screen.findByLabelText('Rôle de Alice'), 'superuser')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ role: 'superuser' }))
  })

  test('un modérateur ne voit pas la gestion des rôles, que le serveur lui refuserait', async () => {
    render(<PlayersSection session={moderator} />)
    expect(await screen.findByText('Alice')).toBeTruthy()
    expect(screen.queryByLabelText('Rôle de Alice')).toBeNull()
  })
})

// ── Toile ────────────────────────────────────────────────────────────────────

describe('<CanvasSection />', () => {
  test('vider la toile exige de recopier VIDER', async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, superadmin.token)
    routes['DELETE /api/admin/canvas'] = () => ({ ok: true, cleared: 4194304 })
    render(<CanvasSection session={superadmin} />)
    await userEvent.click(screen.getByRole('button', { name: 'Vider la toile…' }))
    const confirm = screen.getByRole('button', { name: 'Vider la toile' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)

    await userEvent.type(screen.getByLabelText('Tape « VIDER » pour confirmer'), 'vider')
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    await userEvent.clear(screen.getByLabelText('Tape « VIDER » pour confirmer'))
    await userEvent.type(screen.getByLabelText('Tape « VIDER » pour confirmer'), 'VIDER')
    await userEvent.click(confirm)
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true))
  })

  test('les actions globales sont désactivées pour un modérateur', () => {
    render(<CanvasSection session={moderator} />)
    expect((screen.getByRole('button', { name: 'Vider la toile…' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Restaurer…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  test('parseDisplayInput convertit le repère du HUD et borne la saisie', () => {
    expect(parseDisplayInput('-12', '40')).toEqual({ x: 1012, y: 984 })
    expect(parseDisplayInput('', '1')).toBe('Renseigne X et Y.')
    expect(parseDisplayInput('1.5', '1')).toBe('X et Y sont des nombres entiers.')
    expect(parseDisplayInput('1024', '0')).toMatch(/X va de -1024 à 1023/)
  })
})

// ── Statistiques et journal ──────────────────────────────────────────────────

describe('fillLast24h / niceMax', () => {
  test('complète les heures sans activité et finit sur l\'heure courante', () => {
    const now = Date.UTC(2026, 8, 14, 15, 30)
    const slots = fillLast24h([{ hour: new Date(Date.UTC(2026, 8, 14, 13)).toISOString(), pixels: 42, active_players: 3 }], now)
    expect(slots).toHaveLength(24)
    expect(slots[23].hour).toBe(Date.UTC(2026, 8, 14, 15))
    expect(slots[21]).toMatchObject({ pixels: 42, players: 3 })
    expect(slots.filter((s) => s.pixels > 0)).toHaveLength(1)
  })

  test('arrondit l\'axe à 1, 2 ou 5 × 10ⁿ', () => {
    expect([0, 3, 42, 180, 1234].map(niceMax)).toEqual([10, 5, 50, 200, 2000])
  })
})

test('describeLog rend chaque entrée lisible', () => {
  const base = { id: 1, target: null, admin: 'Modo', reason: null, created_at: '' }
  expect(describeLog({ ...base, action: 'clear_pixel', metadata: { x: 1012, y: 984 } })).toBe('X: -12  Y: 40')
  expect(describeLog({ ...base, action: 'role', metadata: { role: 'superuser' } })).toBe('→ Superuser')
  expect(describeLog({ ...base, action: 'ban', reason: 'spam', metadata: null })).toBe('spam · définitif')
})
