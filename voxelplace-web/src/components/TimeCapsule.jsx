import { useState, useCallback } from 'react'

// Formate une date ISO en "datetime-local" value
function toLocalInput(date) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function TimeCapsule({ gridRef, colors, gridSize = 64, API, onClose }) {
  const [datetime, setDatetime] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() - 1)
    return toLocalInput(d)
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)

  const travel = useCallback(async () => {
    if (!datetime) return
    setLoading(true)
    setError(null)
    try {
      const iso = new Date(datetime).toISOString()
      const res = await fetch(`${API}/api/snapshot?at=${encodeURIComponent(iso)}`)
      if (!res.ok) { setError('Erreur serveur'); return }
      const { grid } = await res.json()

      gridRef.current?.resetGrid()
      const draw = gridRef.current?.drawPixel
      if (draw) {
        for (let i = 0; i < grid.length; i++) {
          if (grid[i] !== 0) {
            draw(i % gridSize, Math.floor(i / gridSize), grid[i])
          }
        }
      }
      setLoadedAt(datetime)
    } catch {
      setError('Impossible de contacter le serveur')
    } finally {
      setLoading(false)
    }
  }, [datetime, API, gridRef, gridSize])

  const displayAt = loadedAt
    ? new Date(loadedAt).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div style={s.panel} role="region" aria-label="Capsule temporelle">
      <div style={s.header}>
        <span style={s.title}>⏰ Time Capsule</span>
        {loadedAt && <span style={s.loaded}>{displayAt}</span>}
        <button style={s.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
      </div>

      <div style={s.controls}>
        <input
          type="datetime-local"
          style={s.input}
          value={datetime}
          max={toLocalInput(new Date())}
          onChange={e => setDatetime(e.target.value)}
          aria-label="Date et heure cible"
        />
        <button style={s.btn} onClick={travel} disabled={loading || !datetime}>
          {loading ? '…' : '🚀 Voyager'}
        </button>
      </div>

      {error && <p style={s.error} role="alert">{error}</p>}
      {loadedAt && (
        <p style={s.hint}>
          Canvas restauré au {displayAt}. Fermer pour revenir au temps présent.
        </p>
      )}
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
    width: 'min(440px, 90vw)',
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
  loaded: {
    fontSize: 11, color: 'var(--accent)', flex: 1, textAlign: 'center',
    fontFamily: 'monospace',
  },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-3)', fontSize: 14, cursor: 'pointer', flexShrink: 0,
  },
  controls: {
    display: 'flex', gap: 8, alignItems: 'center',
  },
  input: {
    flex: 1,
    background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--r-sm)', color: 'var(--text)',
    padding: '6px 10px', fontSize: 12, outline: 'none',
    fontFamily: 'monospace',
    colorScheme: 'dark',
  },
  btn: {
    background: 'var(--accent)', border: 'none',
    borderRadius: 'var(--r-sm)', color: '#fff',
    padding: '6px 14px', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  error: {
    fontSize: 12, color: 'var(--danger)', margin: 0,
  },
  hint: {
    fontSize: 11, color: 'var(--text-3)', margin: 0, fontStyle: 'italic',
  },
}
