// Ordre d'affichage : gradient clair → sombre
// colorId : 0=Blanc, 5=Jaune, 6=Orange, 2=Rouge, 3=Vert, 4=Bleu, 7=Violet, 1=Noir
const GRADIENT_ORDER = [0, 5, 6, 2, 3, 4, 7, 1]
const COLOR_NAMES    = {
  0: 'Blanc',  1: 'Noir',   2: 'Rouge',  3: 'Vert',
  4: 'Bleu',   5: 'Jaune',  6: 'Orange', 7: 'Violet',
}

export default function ColorPicker({ colors, selectedId, onSelect }) {
  return (
    <div style={s.bar}>
      {GRADIENT_ORDER.map((colorId, keyIndex) => {
        const isSelected = colorId === selectedId
        const color      = colors[colorId] ?? '#888'
        const keyHint    = keyIndex + 1

        return (
          <button
            key={colorId}
            style={{
              ...s.swatch,
              background: color,
              boxShadow: isSelected
                ? `0 0 0 2px var(--surface), 0 0 0 4px ${color}`
                : '0 0 0 1px rgba(255,255,255,0.08)',
              transform: isSelected ? 'scale(1.2)' : 'scale(1)',
            }}
            onClick={() => onSelect(colorId)}
            title={`${COLOR_NAMES[colorId]} — ${color}  (touche ${keyHint})`}
          >
            {isSelected && <span style={s.checkmark}>✓</span>}
            <span style={s.keyHint}>{keyHint}</span>
          </button>
        )
      })}
    </div>
  )
}

const s = {
  bar: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  swatch: {
    position: 'relative',
    width: 32, height: 32,
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
    flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  checkmark: {
    position: 'absolute',
    fontSize: 13, fontWeight: 800,
    color: 'rgba(0,0,0,0.55)',
    textShadow: '0 0 4px rgba(255,255,255,0.4)',
    pointerEvents: 'none',
    lineHeight: 1,
  },
  keyHint: {
    position: 'absolute',
    bottom: 2, right: 4,
    fontSize: 8, fontWeight: 700,
    color: 'rgba(255,255,255,0.55)',
    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
    pointerEvents: 'none',
    lineHeight: 1,
    userSelect: 'none',
  },
}
