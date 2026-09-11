'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import { useCanvasStore, DEFAULT_COLORS, COLOR_NAMES } from '../store'
import { formatDisplayCoords } from '../coords'
import { fetchPixelInfo, fetchPixelHistory, type PixelInfo, type PixelHistoryEntry } from '../pixelApi'
import { submitPixelReport } from '@features/report/api'
import { useAuthStore } from '@features/auth/store'
import { notify } from '@features/notifications/store'
import { relativeTime } from '@shared/relativeTime'
import { Button, CloseIcon } from '@shared/ui'

const HISTORY_SHOWN = 10

const SOURCE_LABEL: Record<string, string> = { web: 'web', minecraft: 'Minecraft', moderation: 'modération' }

const REPORT_REASONS = [
  { value: 'Contenu offensant', label: 'Contenu offensant' },
  { value: 'Spam ou vandalisme', label: 'Spam ou vandalisme' },
  { value: 'Autre',             label: 'Autre' },
]

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; info: PixelInfo; history: PixelHistoryEntry[] }

function Swatch({ colorId, size = 14 }: { colorId: number; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-[4px]"
      style={{
        width: size, height: size,
        backgroundColor: DEFAULT_COLORS[colorId] ?? DEFAULT_COLORS[0],
        boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.14)',
      }}
    />
  )
}

function authorLabel(username: string | null, source: string | null) {
  if (source === 'moderation') return 'la modération'
  return username ?? 'un joueur anonyme'
}

/**
 * Inspecteur de pixel : qui l'a posé, quand, son historique, et un moyen de le
 * signaler. S'ouvre au clic en mode Exploration.
 *
 * Ces informations existaient côté serveur (git blame par pixel) sans aucune
 * interface, et signaler un contenu était impossible pour un joueur.
 */
export function PixelInspector() {
  const pixel   = useCanvasStore((s) => s.inspectedPixel)
  const close   = () => useCanvasStore.getState().setInspectedPixel(null)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const titleId = useId()

  useEffect(() => {
    if (!pixel) return
    // Un nouveau clic annule le chargement du pixel précédent : sans cela, une
    // réponse lente pourrait afficher les informations d'un autre pixel.
    const controller = new AbortController()
    setState({ status: 'loading' })
    Promise.all([
      fetchPixelInfo(pixel.x, pixel.y, controller.signal),
      fetchPixelHistory(pixel.x, pixel.y, controller.signal),
    ])
      // On vérifie l'annulation plutôt que de compter sur le rejet de fetch :
      // une réponse déjà reçue, ou une implémentation qui ignore le signal,
      // afficherait sinon le pixel précédent par-dessus le pixel courant.
      .then(([info, history]) => { if (!controller.signal.aborted) setState({ status: 'ready', info, history }) })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error' }) })
    return () => controller.abort()
  }, [pixel?.x, pixel?.y]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pixel) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pixel])

  if (!pixel) return null

  return (
    <aside
      aria-labelledby={titleId}
      // Mobile : au-dessus de la palette, pleine largeur. Grand écran : à côté de la barre d'outils.
      className="fixed inset-x-3 bottom-[140px] z-[35] flex max-h-[45dvh] flex-col gap-4 overflow-y-auto rounded-panel bg-surface p-4 shadow-float md:inset-x-auto md:bottom-auto md:left-20 md:top-20 md:max-h-[calc(100dvh-180px)] md:w-[300px]"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-sm font-semibold text-fg">
          Pixel <span className="ml-1 font-mono text-xs font-normal text-fg-muted">{formatDisplayCoords(pixel.x, pixel.y)}</span>
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Fermer l'inspecteur"
          className="-m-1 rounded-md p-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <span aria-hidden="true" className="inline-flex [&>svg]:size-4"><CloseIcon /></span>
        </button>
      </header>

      {state.status === 'loading' && (
        <p role="status" className="text-sm text-fg-muted">Chargement…</p>
      )}

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-danger">Impossible de charger ce pixel.</p>
      )}

      {state.status === 'ready' && (
        <>
          <PixelSummary info={state.info} />
          <PixelHistory history={state.history} />
          {state.info.source && <ReportForm x={pixel.x} y={pixel.y} key={`${pixel.x},${pixel.y}`} />}
        </>
      )}
    </aside>
  )
}

function PixelSummary({ info }: { info: PixelInfo }) {
  const neverPlaced = !info.source
  return (
    <div className="flex items-center gap-3">
      <Swatch colorId={info.colorId} size={32} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm text-fg">{COLOR_NAMES[info.colorId] ?? 'Inconnue'}</span>
        <span className="text-xs text-fg-muted">
          {neverPlaced
            ? 'Jamais modifié'
            : <>Par {authorLabel(info.username, info.source)}
                {info.source && info.source !== 'moderation' && <> · {SOURCE_LABEL[info.source] ?? info.source}</>}
                {info.updatedAt && <> · {relativeTime(info.updatedAt)}</>}
              </>}
        </span>
      </div>
    </div>
  )
}

function PixelHistory({ history }: { history: PixelHistoryEntry[] }) {
  if (history.length === 0) return null
  const shown = history.slice(0, HISTORY_SHOWN)
  return (
    <section aria-label="Historique du pixel">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        Historique · {history.length}{history.length >= 50 ? '+' : ''}
      </h3>
      <ol className="flex flex-col gap-1.5">
        {shown.map((h, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <Swatch colorId={h.colorId} />
            <span className="min-w-0 flex-1 truncate text-fg">
              {authorLabel(h.username, h.source)}
            </span>
            <time dateTime={h.placedAt} className="shrink-0 text-fg-subtle">{relativeTime(h.placedAt)}</time>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ReportForm({ x, y }: { x: number; y: number }) {
  const [open,    setOpen]    = useState(false)
  const [reason,  setReason]  = useState(REPORT_REASONS[0].value)
  const [pending, setPending] = useState(false)
  const [done,    setDone]    = useState(false)
  const legendId = useId()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    try {
      await submitPixelReport({ x, y, reason, token: useAuthStore.getState().token })
      setDone(true)
      notify({ kind: 'success', message: 'Signalement envoyé. Merci !' })
    } catch (err) {
      notify({ kind: 'error', message: err instanceof Error ? err.message : 'Signalement impossible' })
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return <p className="text-xs text-fg-muted">Pixel signalé.</p>
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-xs text-fg-subtle underline underline-offset-4 transition-colors hover:text-danger"
      >
        Signaler ce pixel
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line pt-3">
      <fieldset aria-labelledby={legendId} className="flex flex-col gap-2">
        <legend id={legendId} className="mb-1 text-sm text-fg">Pourquoi signaler ce pixel ?</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.value} className="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <input
              type="radio"
              name={`raison-${legendId}`}
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="accent-danger"
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setOpen(false)} className="flex-1">Annuler</Button>
        <Button size="sm" type="submit" variant="danger-ghost" disabled={pending} className="flex-1 border border-danger/40">
          {pending ? 'Envoi…' : 'Signaler'}
        </Button>
      </div>
    </form>
  )
}
