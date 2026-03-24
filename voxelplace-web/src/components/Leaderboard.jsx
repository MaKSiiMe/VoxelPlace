const PLATFORM_ICONS = {
  web:       { icon: '🌐', label: 'Web' },
  minecraft: { icon: '⛏',  label: 'Minecraft' },
  roblox:    { icon: '🎮', label: 'Roblox' },
  hytale:    { icon: '🏔', label: 'Hytale' },
}

// Ordre d'affichage fixe
const PLATFORM_ORDER = ['web', 'minecraft', 'roblox', 'hytale']

export default function Leaderboard({ stats, onClose }) {
  const { total = 0, byPlatform = {} } = stats

  return (
    <>
      <div style={s.backdrop} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lb-title"
        style={s.panel}
      >
        <div style={s.header}>
          <span id="lb-title" style={s.title}>📊 Statistiques de la toile</span>
          <button style={s.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div style={s.totalRow}>
          <span style={s.totalLabel}>Total pixels posés</span>
          <span style={s.totalValue}>{total.toLocaleString('fr-FR')}</span>
        </div>

        <div style={s.rows}>
          {PLATFORM_ORDER.map(src => {
            const count = byPlatform[src] ?? 0
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0
            const info  = PLATFORM_ICONS[src]
            return (
              <div key={src} style={s.row}>
                <span style={s.platformLabel}>
                  {info.icon}&ensp;{info.label}
                </span>
                <div style={s.barWrap} title={`${count} pixels (${pct}%)`}>
                  <div style={{ ...s.bar, width: `${pct}%` }} />
                </div>
                <span style={s.count}>{count.toLocaleString('fr-FR')}</span>
                <span style={s.pct}>{pct}%</span>
              </div>
            )
          })}
        </div>

        {total === 0 && (
          <p style={s.empty}>Aucun pixel posé pour l'instant — soyez le premier !</p>
        )}
      </div>
    </>
  )
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 200,
  },
  panel: {
    position: 'fixed', top: 64, right: 16, zIndex: 201,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '20px 24px',
    width: 320,
    boxShadow: 'var(--shadow)',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: {
    fontSize: 14, fontWeight: 700, color: 'var(--text)',
  },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-3)', fontSize: 14, cursor: 'pointer', lineHeight: 1,
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--surface-2)',
    borderRadius: 'var(--r-sm)',
    padding: '10px 14px',
  },
  totalLabel: { fontSize: 13, color: 'var(--text-2)' },
  totalValue: { fontSize: 20, fontWeight: 800, color: 'var(--accent)' },
  rows: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: {
    display: 'grid',
    gridTemplateColumns: '110px 1fr 52px 36px',
    alignItems: 'center', gap: 8,
  },
  platformLabel: { fontSize: 13, color: 'var(--text-2)' },
  barWrap: {
    height: 6, background: 'var(--border)',
    borderRadius: 99, overflow: 'hidden',
  },
  bar: {
    height: '100%', background: 'var(--accent)',
    borderRadius: 99,
    transition: 'width 0.4s ease',
    minWidth: 2,
  },
  count: {
    fontSize: 12, color: 'var(--text)', fontWeight: 600,
    textAlign: 'right', fontFamily: 'monospace',
  },
  pct: {
    fontSize: 11, color: 'var(--text-3)',
    textAlign: 'right',
  },
  empty: {
    fontSize: 13, color: 'var(--text-3)',
    textAlign: 'center', fontStyle: 'italic',
  },
}
