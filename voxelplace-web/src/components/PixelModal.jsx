const SOURCE_LABELS = {
  web:        '🌐 Web',
  minecraft:  '⛏ Minecraft',
  roblox:     '🎮 Roblox',
  hytale:     '🏔 Hytale',
  moderation: '👑 Modération',
}

export default function PixelModal({ pixel, colors, onClear, onClose, readOnly = false }) {
  if (!pixel) return null

  const color    = colors[pixel.colorId] ?? '#FFFFFF'
  const isLight  = isLightColor(color)
  const date     = pixel.updatedAt
    ? new Date(pixel.updatedAt).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null
  const sourceLabel = SOURCE_LABELS[pixel.source] ?? pixel.source ?? '—'
  const isVirgin    = !pixel.username  // jamais modifié

  return (
    <>
      <div style={s.backdrop} className="fade-in" onClick={onClose} />

      <div style={s.modal} className="fade-up" role="dialog" aria-modal="true">
        <button style={s.closeBtn} onClick={onClose} title="Fermer">✕</button>

        {/* En-tête : aperçu couleur + coordonnées */}
        <div style={s.header}>
          <div
            style={{
              ...s.swatch,
              background: color,
              boxShadow: `0 4px 20px ${color}55`,
            }}
          />
          <div>
            <div style={s.coords}>
              ({pixel.x},&thinsp;{pixel.y})
            </div>
            <code style={s.hex}>{color}</code>
          </div>
        </div>

        <div style={s.divider} />

        {/* Métadonnées */}
        {isVirgin ? (
          <p style={s.virgin}>Ce pixel n'a jamais été modifié.</p>
        ) : (
          <div style={s.table}>
            <Row label="Posé par" value={pixel.username} accent />
            <Row label="Source"   value={sourceLabel} />
            {date && <Row label="Date" value={date} />}
          </div>
        )}

        <div style={s.divider} />

        {/* Action */}
        {readOnly ? (
          <button style={s.closeFullBtn} onClick={onClose}>
            Fermer
          </button>
        ) : (
          <button style={s.clearBtn} onClick={onClear}>
            Remettre à blanc
          </button>
        )}
      </div>
    </>
  )
}

function Row({ label, value, accent }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={{ ...s.rowValue, color: accent ? 'var(--text)' : 'var(--text-2)' }}>
        {value}
      </span>
    </div>
  )
}

// Détermine si une couleur hex est claire (pour adapter le texte du swatch)
function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(3px)',
    zIndex: 100,
  },
  modal: {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)', zIndex: 101,
    background: 'var(--surface)',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--r-lg)',
    padding: '28px 32px',
    minWidth: 300, maxWidth: 360,
    display: 'flex', flexDirection: 'column', gap: 16,
    boxShadow: 'var(--shadow)',
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 14,
    background: 'none', border: 'none',
    color: 'var(--text-3)', fontSize: 16,
    cursor: 'pointer', lineHeight: 1,
    transition: 'color 0.15s',
  },
  header: {
    display: 'flex', gap: 16, alignItems: 'center',
  },
  swatch: {
    width: 52, height: 52, borderRadius: 10, flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  coords: {
    fontSize: 22, fontWeight: 800, color: 'var(--text)',
    fontFamily: 'monospace', letterSpacing: 1,
  },
  hex: {
    fontSize: 12, color: 'var(--text-2)',
    background: 'var(--surface-2)',
    padding: '2px 7px', borderRadius: 4,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1, background: 'var(--border)', margin: '0 -4px',
  },
  table: {
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  row: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: 12,
  },
  rowLabel: {
    fontSize: 12, color: 'var(--text-3)', fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  rowValue: {
    fontSize: 13, fontWeight: 600, textAlign: 'right',
  },
  virgin: {
    fontSize: 13, color: 'var(--text-2)', textAlign: 'center',
    fontStyle: 'italic',
  },
  clearBtn: {
    background: 'var(--danger)', border: 'none',
    borderRadius: 'var(--r-md)', color: '#fff',
    padding: '11px 0', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', width: '100%',
    transition: 'background 0.15s',
  },
  closeFullBtn: {
    background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--r-md)', color: 'var(--text-2)',
    padding: '11px 0', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', width: '100%',
    transition: 'background 0.15s',
  },
}
