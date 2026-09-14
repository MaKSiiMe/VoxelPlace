'use client'

import { useId, useState } from 'react'
import { formatDisplayCoords } from '@features/canvas/coords'
import { relativeTime } from '@shared/relativeTime'
import { adminApi, type ModerationLog } from '../api'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { EmptyLine, ErrorLine, LoadingLine, Panel, ROLE_LABELS, formatDate } from './ui'

export const ACTION_LABELS: Record<string, string> = {
  ban:            'Bannissement',
  unban:          'Débannissement',
  clear_pixel:    'Pixel effacé',
  clear_all:      'Toile vidée',
  role:           'Rôle changé',
  restore_canvas: 'Toile restaurée',
}

/** Détail lisible d'une entrée du journal. */
export function describeLog(log: ModerationLog): string {
  const m = log.metadata ?? {}
  switch (log.action) {
    case 'clear_pixel':
      return typeof m.x === 'number' && typeof m.y === 'number' ? formatDisplayCoords(m.x, m.y) : ''
    case 'role':
      return typeof m.role === 'string' && m.role in ROLE_LABELS ? `→ ${ROLE_LABELS[m.role as keyof typeof ROLE_LABELS].label}` : ''
    case 'restore_canvas':
      return typeof m.restored === 'number' ? `${m.restored.toLocaleString('fr-FR')} pixels` : ''
    case 'ban':
      return [log.reason, typeof m.expires_at === 'string' ? `jusqu’au ${formatDate(m.expires_at)}` : 'définitif'].filter(Boolean).join(' · ')
    default:
      return log.reason ?? ''
  }
}

export function LogsSection() {
  const [action, setAction] = useState('')
  const { state, reload } = useAdminQuery((signal) => adminApi.logs(action, signal), [action])
  const selectId = useId()
  const logs = state.data ?? []

  return (
    <Panel
      title="Journal de modération"
      description="Chaque action, signée du modérateur authentifié."
      actions={
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="text-sm text-fg-muted">Action</label>
          <select id={selectId} value={action} onChange={(e) => setAction(e.target.value)} className="h-9 rounded-control border border-line bg-bg px-2 text-sm text-fg">
            <option value="">Toutes</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      }
    >
      {state.status === 'error' && <ErrorLine message={state.error} onRetry={reload} />}
      {state.status === 'loading' && !state.data && <LoadingLine />}
      {state.status === 'ready' && logs.length === 0 && <EmptyLine>Aucune action enregistrée.</EmptyLine>}
      {logs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-fg-subtle">
                <th scope="col" className="py-2 pr-4 font-medium">Quand</th>
                <th scope="col" className="py-2 pr-4 font-medium">Action</th>
                <th scope="col" className="py-2 pr-4 font-medium">Cible</th>
                <th scope="col" className="py-2 pr-4 font-medium">Détail</th>
                <th scope="col" className="py-2 font-medium">Par</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-line/60 last:border-0">
                  <td className="py-2 pr-4 whitespace-nowrap text-fg-muted" title={formatDate(log.created_at)}>{relativeTime(log.created_at)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap text-fg">{ACTION_LABELS[log.action] ?? log.action}</td>
                  <td className="py-2 pr-4 text-fg">{log.target ?? '—'}</td>
                  <td className="py-2 pr-4 text-fg-muted">{describeLog(log) || '—'}</td>
                  <td className="py-2 whitespace-nowrap text-fg-muted">{log.admin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
