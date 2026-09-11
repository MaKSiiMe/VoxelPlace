'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_COLORS, COLOR_NAMES } from '@features/canvas/store'
import { API_URL } from '@shared/api'
import { Dialog } from '@shared/ui'

interface Dashboard {
  rank:           number
  pixels_placed:  number
  colors_used:    number
  favorite_color: number
  streak:         number
  rivals:         { rival: string; overwrites: number }[]
  neighbors:      { neighbor: string; shared_zone_pixels: number }[]
  intact_pixels:  { percent: number; total: number; still_mine: number }
}

type State = { status: 'loading' } | { status: 'empty' } | { status: 'error' } | { status: 'ready'; data: Dashboard }

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control bg-surface-2 px-3 py-2.5">
      <span className="text-xs text-fg-subtle">{label}</span>
      <span className="font-mono text-lg tabular-nums text-fg">{value}</span>
    </div>
  )
}

export function StatsDialog({ open, onClose, username }: { open: boolean; onClose: () => void; username: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const signal = controller.signal
    setState({ status: 'loading' })
    Promise.all([
      fetch(`${API_URL}/api/players/${encodeURIComponent(username)}/dashboard`, { signal }).then((r) => r.json()),
      fetch(`${API_URL}/api/players/${encodeURIComponent(username)}`, { signal }).then((r) => r.json()),
    ])
      .then(([dashboard, player]) => {
        if (signal.aborted) return
        if (dashboard.error || !dashboard.pixels_placed) return setState({ status: 'empty' })
        setState({ status: 'ready', data: { ...dashboard, rank: player.rank ?? 1 } })
      })
      .catch(() => { if (!signal.aborted) setState({ status: 'error' }) })
    return () => controller.abort()
  }, [open, username])

  return (
    <Dialog open={open} onClose={onClose} title="Mes stats" description={username} size="md">
      {state.status === 'loading' && <p role="status" className="py-8 text-center text-sm text-fg-muted">Chargement…</p>}
      {state.status === 'error'   && <p role="alert" className="text-sm text-danger">Impossible de charger tes statistiques.</p>}
      {state.status === 'empty'   && <p className="py-8 text-center text-sm text-fg-muted">Pose ton premier pixel pour voir tes statistiques ici.</p>}

      {state.status === 'ready' && (() => {
        const d = state.data
        return (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Pixels posés" value={d.pixels_placed.toLocaleString('fr-FR')} />
              <Stat label="Rang" value={`#${d.rank}`} />
              <Stat label="Couleurs" value={d.colors_used} />
              {/* Jours consécutifs : à ne pas confondre avec le streak en heures, qui réduit le cooldown */}
              <Stat label="Jours d'affilée" value={d.streak} />
            </div>

            <div className="flex flex-col gap-3 rounded-control bg-surface-2 p-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3">
                <span className="size-8 rounded-md" style={{ backgroundColor: DEFAULT_COLORS[d.favorite_color], boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .14)' }} aria-hidden="true" />
                <div>
                  <p className="text-xs text-fg-subtle">Couleur favorite</p>
                  <p className="text-sm text-fg">{COLOR_NAMES[d.favorite_color]}</p>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs text-fg-subtle">Pixels encore à toi</p>
                  <p className="font-mono text-sm tabular-nums text-fg">{d.intact_pixels.percent} %</p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={d.intact_pixels.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Pixels encore à toi">
                  <div className="h-full rounded-full bg-success" style={{ width: `${d.intact_pixels.percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-fg-subtle">{d.intact_pixels.still_mine} sur {d.intact_pixels.total}</p>
              </div>
            </div>

            {(d.rivals.length > 0 || d.neighbors.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {d.rivals.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Rivaux</h3>
                    <ul className="flex flex-col gap-1">
                      {d.rivals.map((r) => (
                        <li key={r.rival} className="flex justify-between text-sm"><span className="truncate text-fg">{r.rival}</span><span className="font-mono text-danger">{r.overwrites}×</span></li>
                      ))}
                    </ul>
                  </section>
                )}
                {d.neighbors.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Voisins</h3>
                    <ul className="flex flex-col gap-1">
                      {d.neighbors.map((n) => (
                        <li key={n.neighbor} className="flex justify-between text-sm"><span className="truncate text-fg">{n.neighbor}</span><span className="font-mono text-fg-muted">{n.shared_zone_pixels}</span></li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>
        )
      })()}
    </Dialog>
  )
}
