'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import { useCanvasStore, DEFAULT_COLORS, COLOR_NAMES } from '../store'
import { formatDisplayCoords } from '../coords'
import { fetchPixelInfo, fetchPixelHistory, type PixelInfo, type PixelHistoryEntry } from '../pixelApi'
import { submitPixelReport } from '@features/report/api'
import { useAuthStore } from '@features/auth/store'
import { notify } from '@features/notifications/store'
import { relativeTime } from '@shared/relativeTime'
import {
  BEZEL_COLOR, BORDER_COLOR, ACCENT_BLUE, ACCENT_RED, MUTED_TEXT, TEXT_COLOR,
} from '@features/hud/theme'

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
      style={{
        display: 'inline-block', width: size, height: size, flexShrink: 0,
        background: DEFAULT_COLORS[colorId] ?? DEFAULT_COLORS[0],
        border: `1px solid ${BORDER_COLOR}`, borderRadius: 3,
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
      className="fixed inset-x-3 bottom-[140px] z-[35] max-h-[45dvh] md:inset-x-auto md:bottom-auto md:left-20 md:top-20 md:max-h-[calc(100dvh-180px)] md:w-[300px]"
      style={{
        overflowY:     'auto',
        background:    BEZEL_COLOR,
        border:        `1px solid ${BORDER_COLOR}`,
        borderRadius:  10,
        padding:       16,
        boxShadow:     '0 4px 24px rgba(0,0,0,0.6)',
        display:       'flex',
        flexDirection: 'column',
        gap:           14,
        fontFamily:    'monospace',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h2 id={titleId} style={{ margin: 0, color: ACCENT_BLUE, fontSize: 13, fontWeight: 700 }}>
          Pixel <span style={{ color: TEXT_COLOR, fontWeight: 400 }}>{formatDisplayCoords(pixel.x, pixel.y)}</span>
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Fermer l'inspecteur"
          style={{ background: 'transparent', border: 'none', color: MUTED_TEXT, cursor: 'pointer', fontSize: 14, padding: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT_RED)}
          onMouseLeave={(e) => (e.currentTarget.style.color = MUTED_TEXT)}
        >
          ✕
        </button>
      </header>

      {state.status === 'loading' && (
        <p role="status" style={{ margin: 0, color: MUTED_TEXT, fontSize: 12 }}>Chargement…</p>
      )}

      {state.status === 'error' && (
        <p role="alert" style={{ margin: 0, color: ACCENT_RED, fontSize: 12 }}>
          Impossible de charger ce pixel.
        </p>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Swatch colorId={info.colorId} size={28} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ color: TEXT_COLOR, fontSize: 13 }}>{COLOR_NAMES[info.colorId] ?? 'Inconnue'}</span>
        <span style={{ color: MUTED_TEXT, fontSize: 11 }}>
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
      <h3 style={{ margin: '0 0 8px', color: MUTED_TEXT, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Historique · {history.length}{history.length >= 50 ? '+' : ''}
      </h3>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.map((h, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
            <Swatch colorId={h.colorId} />
            <span style={{ color: TEXT_COLOR, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {authorLabel(h.username, h.source)}
            </span>
            <time dateTime={h.placedAt} style={{ color: MUTED_TEXT, flexShrink: 0 }}>{relativeTime(h.placedAt)}</time>
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
    return <p style={{ margin: 0, color: MUTED_TEXT, fontSize: 11 }}>Pixel signalé.</p>
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          alignSelf: 'flex-start', background: 'transparent', border: 'none', padding: 0,
          color: MUTED_TEXT, fontSize: 11, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT_RED)}
        onMouseLeave={(e) => (e.currentTarget.style.color = MUTED_TEXT)}
      >
        Signaler ce pixel
      </button>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${BORDER_COLOR}`, paddingTop: 12 }}>
      <fieldset aria-labelledby={legendId} style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <legend id={legendId} style={{ color: TEXT_COLOR, fontSize: 12, marginBottom: 4 }}>Pourquoi signaler ce pixel ?</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 8, color: TEXT_COLOR, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="radio"
              name={`raison-${legendId}`}
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              style={{ accentColor: ACCENT_RED }}
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ flex: 1, padding: '6px 0', background: 'transparent', border: `1px solid ${BORDER_COLOR}`, borderRadius: 6, color: TEXT_COLOR, fontSize: 11, cursor: 'pointer' }}
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending}
          style={{ flex: 1, padding: '6px 0', background: 'transparent', border: `1px solid ${ACCENT_RED}`, borderRadius: 6, color: ACCENT_RED, fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer' }}
        >
          {pending ? 'Envoi…' : 'Signaler'}
        </button>
      </div>
    </form>
  )
}
