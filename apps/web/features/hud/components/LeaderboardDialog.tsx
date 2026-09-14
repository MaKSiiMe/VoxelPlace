'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_COLORS, COLOR_NAMES } from '@features/canvas/store'
import { useAuthStore } from '@features/auth/store'
import { API_URL } from '@shared/api'
import { relativeTime } from '@shared/relativeTime'
import { Dialog, cn } from '@shared/ui'

interface Entry {
  rank:           number
  username:       string
  pixels_placed:  number
  colors_used:    number
  favorite_color: number
  last_active:    string
}

const MEDAL: Record<number, string> = { 1: 'text-warning', 2: 'text-fg-muted', 3: 'text-[#d19a66]' }

export function LeaderboardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useAuthStore((s) => s.username)
  const [rows,  setRows]  = useState<Entry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetch(`${API_URL}/api/leaderboard?limit=20`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setRows(d.leaderboard ?? []))
      .catch((e) => { if (e?.name !== 'AbortError') setError(true) })
    return () => controller.abort()
  }, [open])

  return (
    <Dialog open={open} onClose={onClose} title="Classement" description="Les joueurs qui ont posé le plus de pixels." size="md">
      {error && <p role="alert" className="text-sm text-danger">Impossible de charger le classement.</p>}
      {!error && !rows && <p role="status" className="py-8 text-center text-sm text-fg-muted">Chargement…</p>}
      {rows?.length === 0 && <p className="py-8 text-center text-sm text-fg-muted">Personne n&apos;a encore posé de pixel. À toi de commencer !</p>}

      {rows && rows.length > 0 && (
        <ol className="flex flex-col gap-1">
          {rows.map((r) => {
            const isMe = me && r.username.toLowerCase() === me.toLowerCase()
            return (
              <li
                key={r.username}
                aria-current={isMe ? 'true' : undefined}
                className={cn('flex items-center gap-3 rounded-control px-3 py-2', isMe ? 'bg-accent/10' : 'hover:bg-surface-2')}
              >
                <span className={cn('w-8 font-mono text-sm tabular-nums', MEDAL[r.rank] ?? 'text-fg-subtle')}>#{r.rank}</span>
                <span
                  className="size-4 shrink-0 rounded-[4px]"
                  style={{ backgroundColor: DEFAULT_COLORS[r.favorite_color], boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .14)' }}
                  title={`Couleur favorite : ${COLOR_NAMES[r.favorite_color]}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-fg">
                  {r.username}{isMe && <span className="ml-2 text-xs text-accent">toi</span>}
                </span>
                <span className="hidden text-xs text-fg-subtle sm:inline">{relativeTime(r.last_active)}</span>
                <span className="w-20 text-right font-mono text-sm tabular-nums text-fg">
                  {r.pixels_placed.toLocaleString('fr-FR')}<span className="sr-only"> pixels</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </Dialog>
  )
}
