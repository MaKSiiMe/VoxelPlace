import { useState, useEffect } from 'react'

const SOURCE_ICONS = { web: '🌐', minecraft: '⛏', roblox: '🎮', hytale: '🏔', moderation: '👑' }

export default function PixelHistory({ x, y, colors, API, onClose }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    fetch(`${API}/api/pixel/${x}/${y}/history`)
      .then(r => r.json())
      .then(data => { setHistory(data.history); setLoading(false) })
      .catch(() => { setError('Impossible de charger l\'historique'); setLoading(false) })
  }, [API, x, y])

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.panel} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Historique du pixel (${x}, ${y})`}>
        <div style={s.header}>
          <span style={s.title}>📜 Historique ({x},&thinsp;{y})</span>
          <button style={s.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div style={s.list}>
          {loading && <p style={s.info}>Chargement…</p>}
          {error   && <p style={s.info}>{error}</p>}
          {history?.length === 0 && <p style={s.info}>Aucun historique pour ce pixel.</p>}
          {history?.map((entry, i) => (
            <div key={i} style={{ ...s.entry, ...(i === 0 ? s.entryFirst : {}) }}>
              <div style={{ ...s.dot, background: colors[entry.colorId] ?? '#fff' }} />
              <div style={s.entryInfo}>
                <span style={s.entryUser}>
                  {entry.username ?? '—'}&ensp;{SOURCE_ICONS[entry.source] ?? ''}
                </span>
                <span style={s.entryDate}>
                  {new Date(entry.placedAt).toLocaleString('fr-FR')}
                </span>
              </div>
              {i === 0 && <span style={s.badge}>Actuel</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 200,
  },
  panel: {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(10,10,25,0.96)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '16px',
    width: 'min(340px, 90vw)',
    display: 'flex', flexDirection: 'column', gap: 12,
    boxShadow: 'var(--shadow)',
    backdropFilter: 'blur(8px)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: {
    fontSize: 13, fontWeight: 700, color: 'var(--text)',
  },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-3)', fontSize: 14, cursor: 'pointer',
  },
  list: {
    overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
    maxHeight: '55vh',
  },
  entry: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 10px',
    background: 'var(--surface-2)',
    borderRadius: 6,
  },
  entryFirst: {
    border: '1px solid var(--accent)',
  },
  dot: {
    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.12)',
  },
  entryInfo: {
    display: 'flex', flexDirection: 'column', gap: 2, flex: 1,
  },
  entryUser: {
    fontSize: 12, fontWeight: 600, color: 'var(--text)',
  },
  entryDate: {
    fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace',
  },
  badge: {
    fontSize: 9, fontWeight: 700, color: 'var(--accent)',
    background: 'rgba(var(--accent-rgb, 100,100,255),0.15)',
    padding: '2px 6px', borderRadius: 99, flexShrink: 0,
    border: '1px solid var(--accent)',
  },
  info: {
    fontSize: 12, color: 'var(--text-2)', textAlign: 'center',
    padding: '16px 0', margin: 0,
  },
}
