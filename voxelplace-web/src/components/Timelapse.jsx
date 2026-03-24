import { useState, useEffect, useRef, useCallback } from 'react'

const SPEEDS = [
  { label: '×1',   eventsPerFrame: 1  },
  { label: '×5',   eventsPerFrame: 5  },
  { label: '×20',  eventsPerFrame: 20 },
  { label: '×100', eventsPerFrame: 100 },
  { label: 'MAX',  eventsPerFrame: Infinity },
]

const FRAME_MS = 33 // ~30fps

export default function Timelapse({ gridRef, colors, API, onClose }) {
  const [history,   setHistory]   = useState(null)   // array of events
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [playing,   setPlaying]   = useState(false)
  const [cursor,    setCursor]    = useState(0)       // index courant dans history
  const [speedIdx,  setSpeedIdx]  = useState(1)       // index dans SPEEDS

  const intervalRef = useRef(null)
  const cursorRef   = useRef(0)  // ref pour éviter les closures périmées

  // ── Chargement de l'historique ────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/history?limit=50000`)
      .then(r => r.json())
      .then(data => {
        setHistory(data.history)
        setLoading(false)
        // Réinitialise le canvas à blanc pour le replay
        gridRef.current?.resetGrid()
      })
      .catch(() => {
        setError('Impossible de charger l\'historique')
        setLoading(false)
      })
  }, [API, gridRef])

  // ── Nettoyage à la fermeture ──────────────────────────────────────────────
  useEffect(() => () => clearInterval(intervalRef.current), [])

  // ── Lecteur ───────────────────────────────────────────────────────────────
  const applyEvents = useCallback((from, count) => {
    if (!history) return from
    const draw = gridRef.current?.drawPixel
    if (!draw) return from

    const isMax = !isFinite(count)
    const end = isMax ? history.length : Math.min(from + count, history.length)

    for (let i = from; i < end; i++) {
      const { x, y, colorId } = history[i]
      draw(x, y, colorId)
    }
    return end
  }, [history, gridRef])

  const stop = useCallback(() => {
    clearInterval(intervalRef.current)
    intervalRef.current = null
    setPlaying(false)
  }, [])

  const play = useCallback(() => {
    if (!history || cursorRef.current >= history.length) return
    setPlaying(true)
    const { eventsPerFrame } = SPEEDS[speedIdx]

    intervalRef.current = setInterval(() => {
      const next = applyEvents(cursorRef.current, eventsPerFrame)
      cursorRef.current = next
      setCursor(next)

      if (next >= history.length) {
        stop()
      }
    }, isFinite(eventsPerFrame) ? FRAME_MS : 0)
  }, [history, speedIdx, applyEvents, stop])

  const restart = useCallback(() => {
    stop()
    cursorRef.current = 0
    setCursor(0)
    gridRef.current?.resetGrid()
  }, [stop, gridRef])

  const togglePlay = useCallback(() => {
    if (playing) { stop(); return }
    if (cursor >= (history?.length ?? 0)) { restart(); return }
    play()
  }, [playing, cursor, history, stop, play, restart])

  // Repart si on change de vitesse pendant la lecture
  useEffect(() => {
    if (playing) { stop(); play() }
  }, [speedIdx]) // eslint-disable-line

  const total    = history?.length ?? 0
  const progress = total > 0 ? cursor / total : 0

  const currentDate = history && cursor > 0
    ? new Date(history[Math.min(cursor, total - 1)].placedAt).toLocaleString('fr-FR')
    : '—'

  return (
    <div style={s.panel} role="region" aria-label="Lecteur timelapse">
      <div style={s.header}>
        <span style={s.title}>⏳ Timelapse</span>
        <span style={s.date}>{loading ? 'Chargement…' : error ?? currentDate}</span>
        <button style={s.closeBtn} onClick={onClose} aria-label="Fermer le timelapse">✕</button>
      </div>

      {/* Barre de progression */}
      <div style={s.progressTrack} title={`${cursor} / ${total} événements`}>
        <div style={{ ...s.progressBar, width: `${progress * 100}%` }} />
      </div>

      <div style={s.controls}>
        {/* Retour au début */}
        <button style={s.btn} onClick={restart} disabled={loading || !!error} title="Retour au début">
          ⏮
        </button>

        {/* Play / Pause */}
        <button style={{ ...s.btn, ...s.btnPlay }} onClick={togglePlay} disabled={loading || !!error}>
          {playing ? '⏸' : '▶'}
        </button>

        {/* Compteur */}
        <span style={s.counter}>{cursor.toLocaleString('fr-FR')} / {total.toLocaleString('fr-FR')}</span>

        {/* Sélecteur de vitesse */}
        <div style={s.speeds}>
          {SPEEDS.map((sp, i) => (
            <button
              key={sp.label}
              style={{ ...s.speedBtn, ...(i === speedIdx ? s.speedActive : {}) }}
              onClick={() => setSpeedIdx(i)}
            >
              {sp.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const s = {
  panel: {
    position: 'absolute', bottom: 80, left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 50,
    background: 'rgba(10,10,25,0.92)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '12px 16px',
    width: 'min(480px, 90vw)',
    backdropFilter: 'blur(8px)',
    boxShadow: 'var(--shadow)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  title: {
    fontSize: 13, fontWeight: 700, color: 'var(--text)', flexShrink: 0,
  },
  date: {
    fontSize: 11, color: 'var(--text-3)', flex: 1, textAlign: 'center',
    fontFamily: 'monospace',
  },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-3)', fontSize: 14, cursor: 'pointer', flexShrink: 0,
  },
  progressTrack: {
    height: 4, background: 'var(--border)',
    borderRadius: 99, overflow: 'hidden',
  },
  progressBar: {
    height: '100%', background: 'var(--accent)',
    borderRadius: 99, transition: 'width 0.1s linear',
  },
  controls: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  btn: {
    background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--r-sm)', color: 'var(--text)',
    width: 32, height: 28, fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  btnPlay: {
    background: 'var(--accent)', border: 'none', color: '#fff',
    width: 36, height: 28,
  },
  counter: {
    fontSize: 11, color: 'var(--text-3)',
    fontFamily: 'monospace', flex: 1, textAlign: 'center',
  },
  speeds: {
    display: 'flex', gap: 3, flexShrink: 0,
  },
  speedBtn: {
    background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--r-sm)', color: 'var(--text-3)',
    padding: '3px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
  },
  speedActive: {
    background: 'var(--accent)', border: '1px solid var(--accent)',
    color: '#fff',
  },
}
