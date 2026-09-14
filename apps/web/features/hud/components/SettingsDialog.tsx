'use client'

import { useCanvasStore, type UserRole } from '@features/canvas/store'
import { DeleteAccountSection } from '@features/auth/components/DeleteAccountSection'
import { Button, Dialog, LogoutIcon } from '@shared/ui'

const ROLE_LABEL: Record<UserRole, { label: string; className: string }> = {
  user:       { label: 'Joueur',         className: 'bg-bg text-fg-muted' },   // la carte est déjà en surface-2
  superuser:  { label: 'Contributeur',   className: 'bg-warning/15 text-warning' },
  admin:      { label: 'Modérateur',     className: 'bg-accent/15 text-accent' },
  superadmin: { label: 'Administrateur', className: 'bg-danger/15 text-danger' },
}

interface Props {
  open:       boolean
  onClose:    () => void
  username:   string
  onLogout:   () => void
  onOpenAuth: () => void
}

export function SettingsDialog({ open, onClose, username, onLogout, onOpenAuth }: Props) {
  const role = useCanvasStore((s) => s.role)

  return (
    <Dialog open={open} onClose={onClose} title="Paramètres" size="sm">
      {!role ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <p className="text-sm text-fg-muted">Tu regardes la toile en visiteur.</p>
          <Button variant="primary" onClick={() => { onClose(); onOpenAuth() }}>Se connecter pour jouer</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-control bg-surface-2 p-3">
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-accent/15 text-base font-semibold text-accent">
              {username.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{username}</p>
              <span className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-xs ${ROLE_LABEL[role].className}`}>
                {ROLE_LABEL[role].label}
              </span>
            </div>
          </div>

          <Button onClick={() => { onClose(); onLogout() }} className="w-full">
            <span aria-hidden="true" className="inline-flex [&>svg]:size-4"><LogoutIcon /></span>
            Se déconnecter
          </Button>

          <div className="border-t border-line pt-4">
            <DeleteAccountSection onDeleted={onClose} />
          </div>
        </div>
      )}
    </Dialog>
  )
}
