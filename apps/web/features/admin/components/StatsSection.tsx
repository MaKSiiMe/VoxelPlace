'use client'

import { relativeTime } from '@shared/relativeTime'
import { adminApi } from '../api'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { ActivityChart, fillLast24h } from './ActivityChart'
import { ErrorLine, LoadingLine, Panel } from './ui'

const full = new Intl.NumberFormat('fr-FR')
const compactFormat = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })
// En dessous de 10 000, « 1 k » masquerait l'information : le nombre entier tient
const compact = { format: (n: number) => (n >= 10_000 ? compactFormat : full).format(n) }

const PLATFORM_LABELS: Record<string, string> = { web: 'Web', minecraft: 'Minecraft', moderation: 'Modération' }

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control border border-line bg-surface px-4 py-3">
      <span className="text-xs text-fg-subtle">{label}</span>
      <span className="text-2xl font-semibold text-fg" title={full.format(value)}>{compact.format(value)}</span>
      {hint && <span className="text-xs text-fg-subtle">{hint}</span>}
    </div>
  )
}

export function StatsSection() {
  const { state, reload } = useAdminQuery((signal) => adminApi.dashboard(signal), [])
  if (state.status === 'error' && !state.data) return <ErrorLine message={state.error} onRetry={reload} />
  if (!state.data) return <LoadingLine />
  const d = state.data
  const platformMax = Math.max(1, ...d.by_platform.map((p) => p.pixels))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="Pixels aujourd’hui" value={d.global.pixels_today} hint={`${full.format(d.global.total_pixels)} au total`} />
        <Tile label="Joueurs aujourd’hui" value={d.global.unique_players_today} hint={`${full.format(d.global.unique_players)} au total`} />
        <Tile label="Connectés maintenant" value={d.global.connected_now} hint="visiteurs compris" />
        <Tile label="Bannissements en cours" value={d.global.bans_total} />
      </div>

      <Panel title="Activité des dernières 24 heures" description={d.global.last_activity ? `Dernier pixel ${relativeTime(d.global.last_activity)}.` : 'Aucun pixel posé.'}>
        <ActivityChart slots={fillLast24h(d.hourly_24h)} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Pixels par plateforme" description="Depuis le début.">
          <ul className="flex flex-col gap-3">
            {d.by_platform.map((p) => (
              <li key={p.source} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-sm">
                <span className="text-fg-muted">{PLATFORM_LABELS[p.source] ?? p.source}</span>
                <span className="h-3 overflow-hidden rounded-r-[4px] bg-bg" aria-hidden="true">
                  <span className="block h-full rounded-r-[4px] bg-accent" style={{ width: `${(p.pixels / platformMax) * 100}%` }} />
                </span>
                <span className="text-right font-mono tabular-nums text-fg">{full.format(p.pixels)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Joueurs les plus actifs" description="Depuis le début.">
          <ol className="flex flex-col gap-1 text-sm">
            {d.top_players.map((p, i) => (
              <li key={`${p.username}-${p.source}`} className="flex items-center gap-3">
                <span className="w-6 font-mono text-xs text-fg-subtle">#{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-fg">{p.username}</span>
                <span className="text-xs text-fg-subtle">{PLATFORM_LABELS[p.source] ?? p.source}</span>
                <span className="w-16 text-right font-mono tabular-nums text-fg">{full.format(p.pixels)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  )
}
