'use client'

import { useState } from 'react'
import { formatDisplayCoords } from '@features/canvas/coords'
import { pixelLink } from '@features/canvas/pixelLink'
import { relativeTime } from '@shared/relativeTime'
import { Button, cn } from '@shared/ui'
import { adminApi, type Report, type ReportStatus } from '../api'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { BanDialog } from './BanDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { EmptyLine, ErrorLine, LoadingLine, Notice, Panel, Segmented, formatDate } from './ui'

const FILTERS: { value: ReportStatus; label: string }[] = [
  { value: 'pending',  label: 'À traiter' },
  { value: 'reviewed', label: 'Traités' },
  { value: 'all',      label: 'Tous' },
]

export function ReportsSection({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<ReportStatus>('pending')
  const { state, reload } = useAdminQuery((signal) => adminApi.reports(status, signal), [status])
  const [banTarget,   setBanTarget]   = useState<string | null>(null)
  const [clearTarget, setClearTarget] = useState<Report | null>(null)
  const [notice,      setNotice]      = useState<string | null>(null)

  const refresh = () => { reload(); onChanged?.() }
  const reports = state.data ?? []

  async function review(id: number) {
    try {
      await adminApi.reviewReport(id)
      setNotice('Signalement marqué comme traité.')
      refresh()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Action impossible')
    }
  }

  return (
    <Panel
      title="Signalements"
      description="Pixels et joueurs signalés depuis l'inspecteur de pixel."
      actions={<Segmented label="Filtrer les signalements" value={status} options={FILTERS} onChange={setStatus} />}
    >
      <Notice message={notice} />

      {state.status === 'error' && <ErrorLine message={state.error} onRetry={reload} />}
      {state.status === 'loading' && !state.data && <LoadingLine />}
      {state.status === 'ready' && reports.length === 0 && (
        <EmptyLine>{status === 'pending' ? 'Aucun signalement à traiter.' : 'Aucun signalement.'}</EmptyLine>
      )}

      {reports.length > 0 && (
        <ul className="flex flex-col gap-2">
          {reports.map((r) => (
            <li key={r.id}>
              <ReportCard
                report={r}
                onReview={() => review(r.id)}
                onBan={(u) => setBanTarget(u)}
                onClear={() => setClearTarget(r)}
              />
            </li>
          ))}
        </ul>
      )}

      <BanDialog
        open={banTarget !== null}
        username={banTarget ?? ''}
        onClose={() => setBanTarget(null)}
        onBanned={(u) => { setNotice(`${u} est banni.`); refresh() }}
      />
      <ConfirmDialog
        open={clearTarget !== null}
        onClose={() => setClearTarget(null)}
        title="Effacer ce pixel ?"
        description={clearTarget?.x != null && clearTarget.y != null && (
          <>Le pixel <span className="font-mono text-fg">{formatDisplayCoords(clearTarget.x, clearTarget.y)}</span> redevient blanc
          pour tous les joueurs, sur le web et dans Minecraft.</>
        )}
        confirmLabel="Effacer"
        onConfirm={async () => {
          if (clearTarget?.x == null || clearTarget.y == null) return
          const { previousOwner } = await adminApi.clearPixel(clearTarget.x, clearTarget.y)
          setNotice(`Pixel effacé${previousOwner ? ` (il appartenait à ${previousOwner})` : ''}.`)
          refresh()
        }}
      />
    </Panel>
  )
}

function ReportCard({ report: r, onReview, onBan, onClear }: {
  report: Report; onReview: () => void; onBan: (username: string) => void; onClear: () => void
}) {
  const isPixel = r.target_type === 'pixel' && r.x !== null && r.y !== null
  return (
    <article
      aria-label={`Signalement ${r.id}`}
      className={cn('flex flex-col gap-3 rounded-control border p-3 sm:flex-row sm:items-start', r.status === 'pending' ? 'border-line-strong' : 'border-line opacity-80')}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-muted">
            {isPixel ? 'Pixel' : 'Joueur'}
          </span>
          {isPixel && <span className="font-mono text-xs text-fg">{formatDisplayCoords(r.x!, r.y!)}</span>}
          {r.target_username && <span className="font-medium text-fg">{r.target_username}</span>}
          {r.status === 'reviewed' && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">Traité</span>}
        </div>
        <p className={cn('mt-1.5 text-sm', r.reason ? 'text-fg' : 'italic text-fg-subtle')}>
          {r.reason ?? 'Sans motif'}
        </p>
        <p className="mt-1 text-xs text-fg-subtle">
          <span title={formatDate(r.created_at)}>{relativeTime(r.created_at)}</span>
          {' · '}signalé par {r.reporter ?? 'un visiteur'}
          {r.status === 'reviewed' && r.reviewed_by && <> · traité par {r.reviewed_by}</>}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {isPixel && (
          <a
            href={pixelLink(r.x!, r.y!)}
            target="_blank"
            rel="noopener"
            className="inline-flex h-8 items-center rounded-control border border-line bg-surface-2 px-3 text-xs font-medium text-fg hover:border-line-strong"
          >
            Voir sur la toile<span className="sr-only"> (nouvel onglet)</span>
          </a>
        )}
        {isPixel && <Button size="sm" variant="danger-ghost" onClick={onClear}>Effacer le pixel</Button>}
        {r.target_username && <Button size="sm" variant="danger-ghost" onClick={() => onBan(r.target_username!)}>Bannir</Button>}
        {r.status === 'pending' && <Button size="sm" variant="primary" onClick={onReview}>Marquer traité</Button>}
      </div>
    </article>
  )
}
