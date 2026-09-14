'use client'

import { useEffect, useId, useState } from 'react'
import { relativeTime } from '@shared/relativeTime'
import { Button, Field, cn } from '@shared/ui'
import { adminApi, type AdminUser, type Ban, type Role } from '../api'
import { useAdminQuery } from '../hooks/useAdminQuery'
import type { AdminSession } from '../session'
import { BanDialog } from './BanDialog'
import { EmptyLine, ErrorLine, LoadingLine, Notice, Panel, ROLE_LABELS, RoleBadge, formatDate } from './ui'

const ROLES: Role[] = ['user', 'superuser', 'admin', 'superadmin']

export function PlayersSection({ session }: { session: AdminSession }) {
  const [query,    setQuery]    = useState('')
  const [debounced, setDebounced] = useState('')
  const [notice,   setNotice]   = useState<string | null>(null)
  const [banTarget, setBanTarget] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const users = useAdminQuery((signal) => adminApi.users(debounced, signal), [debounced])
  const bans  = useAdminQuery((signal) => adminApi.bans(signal), [])
  const refresh = () => { users.reload(); bans.reload() }

  async function unban(username: string) {
    try {
      await adminApi.unban(username)
      setNotice(`${username} n'est plus banni.`)
      refresh()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Débannissement impossible')
    }
  }

  const canGrantRoles = session.role === 'superadmin'
  const list = users.state.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Joueurs"
        description={canGrantRoles
          ? 'Cherche un compte pour le bannir ou changer son rôle. Sans recherche, la liste montre l’équipe.'
          : 'Cherche un compte pour le bannir. Seul un administrateur peut changer les rôles.'}
        actions={<Button size="sm" variant="danger-ghost" onClick={() => setBanTarget('')}>Bannir un pseudo…</Button>}
      >
        <div className="mb-4 max-w-sm">
          <Field label="Rechercher un joueur" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Début du pseudo" autoComplete="off" />
        </div>
        <Notice message={notice} />

        {users.state.status === 'error' && <ErrorLine message={users.state.error} onRetry={users.reload} />}
        {users.state.status === 'loading' && !users.state.data && <LoadingLine />}
        {users.state.status === 'ready' && list.length === 0 && (
          <EmptyLine>{debounced ? `Aucun compte ne commence par « ${debounced} ».` : 'Aucun membre de l’équipe pour l’instant.'}</EmptyLine>
        )}

        {list.length > 0 && (
          <>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              {debounced ? 'Résultats' : 'L’équipe'}
            </h3>
            <ul className="divide-y divide-line rounded-control border border-line">
              {list.map((u) => (
                <UserRow
                  key={u.username}
                  user={u}
                  canGrantRoles={canGrantRoles}
                  isSelf={session.username?.toLowerCase() === u.username.toLowerCase()}
                  onBan={() => setBanTarget(u.username)}
                  onUnban={() => unban(u.username)}
                  onRoleChanged={(role) => { setNotice(`${u.username} est maintenant ${ROLE_LABELS[role].label.toLowerCase()}.`); users.reload() }}
                  onError={setNotice}
                />
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Bannissements" description="Les bannissements expirés restent listés pour l’historique.">
        {bans.state.status === 'error' && <ErrorLine message={bans.state.error} onRetry={bans.reload} />}
        {bans.state.status === 'loading' && !bans.state.data && <LoadingLine />}
        {bans.state.status === 'ready' && bans.state.data.length === 0 && <EmptyLine>Personne n’est banni.</EmptyLine>}
        {(bans.state.data?.length ?? 0) > 0 && (
          <ul className="divide-y divide-line rounded-control border border-line">
            {bans.state.data!.map((b) => <BanRow key={b.username} ban={b} onUnban={() => unban(b.username)} />)}
          </ul>
        )}
      </Panel>

      <BanDialog
        open={banTarget !== null}
        username={banTarget ?? ''}
        onClose={() => setBanTarget(null)}
        onBanned={(u) => { setNotice(`${u} est banni.`); refresh() }}
      />
    </div>
  )
}

function banDuration(expiresAt: string | null) {
  return expiresAt ? `jusqu’au ${formatDate(expiresAt)}` : 'définitivement'
}

function UserRow({ user: u, canGrantRoles, isSelf, onBan, onUnban, onRoleChanged, onError }: {
  user: AdminUser; canGrantRoles: boolean; isSelf: boolean
  onBan: () => void; onUnban: () => void; onRoleChanged: (role: Role) => void; onError: (message: string) => void
}) {
  const [role, setRole] = useState<Role>(u.role)
  const [busy, setBusy] = useState(false)
  const selectId = useId()
  useEffect(() => setRole(u.role), [u.role])

  async function saveRole() {
    setBusy(true)
    try {
      await adminApi.setRole(u.username, role)
      onRoleChanged(role)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Changement de rôle impossible')
      setRole(u.role)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{u.username}</span>
          <RoleBadge role={u.role} />
          {isSelf && <span className="text-xs text-accent">toi</span>}
        </div>
        <p className={cn('mt-0.5 text-xs', u.banned ? 'text-danger' : 'text-fg-subtle')}>
          {u.banned
            ? `Banni ${banDuration(u.ban_expires_at)}${u.ban_reason ? ` — ${u.ban_reason}` : ''}`
            : `Inscrit ${relativeTime(u.created_at)}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canGrantRoles && (
          <>
            <label htmlFor={selectId} className="sr-only">Rôle de {u.username}</label>
            <select
              id={selectId}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={busy || isSelf}
              title={isSelf ? 'Tu ne peux pas changer ton propre rôle' : undefined}
              className="h-8 rounded-control border border-line bg-bg px-2 text-sm text-fg disabled:opacity-50"
            >
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r].label}</option>)}
            </select>
            {role !== u.role && (
              <Button size="sm" variant="primary" onClick={saveRole} disabled={busy}>Enregistrer</Button>
            )}
          </>
        )}
        {u.banned
          ? <Button size="sm" variant="secondary" onClick={onUnban}>Débannir</Button>
          : !isSelf && <Button size="sm" variant="danger-ghost" onClick={onBan}>Bannir</Button>}
      </div>
    </li>
  )
}

function BanRow({ ban: b, onUnban }: { ban: Ban; onUnban: () => void }) {
  return (
    <li className={cn('flex flex-col gap-2 p-3 sm:flex-row sm:items-center', !b.active && 'opacity-70')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{b.username}</span>
          {b.active
            ? <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-medium text-danger">{b.expires_at ? 'Temporaire' : 'Définitif'}</span>
            : <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-muted">Expiré</span>}
        </div>
        <p className="mt-0.5 text-xs text-fg-subtle">
          {b.reason ?? 'Sans motif'} · par {b.banned_by ?? 'inconnu'} · {relativeTime(b.banned_at)}
          {b.active && b.expires_at && <> · jusqu’au {formatDate(b.expires_at)}</>}
        </p>
      </div>
      {b.active && <Button size="sm" variant="secondary" className="self-start sm:self-auto" onClick={onUnban}>Débannir</Button>}
    </li>
  )
}
