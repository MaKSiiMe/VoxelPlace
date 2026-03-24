import { useState, useEffect } from 'react'

const W = 100
const H = 28

export default function Pulse({ API }) {
  const [pulse, setPulse] = useState([])

  useEffect(() => {
    function load() {
      fetch(`${API}/api/pulse`)
        .then(r => r.json())
        .then(data => setPulse(data.pulse ?? []))
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [API])

  if (pulse.length === 0) return null

  const max     = Math.max(1, ...pulse.map(p => p.count))
  const last    = pulse[pulse.length - 1]?.count ?? 0
  const n       = pulse.length

  const points = pulse.map((p, i) => {
    const px = (i / Math.max(n - 1, 1)) * W
    const py = H - (p.count / max) * (H - 2)
    return `${px.toFixed(1)},${py.toFixed(1)}`
  }).join(' ')

  return (
    <div style={s.wrap} title="Activité des 3 dernières heures">
      <svg width={W} height={H} style={s.svg} aria-hidden="true">
        <defs>
          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${points} ${W},${H}`} fill="url(#pg)" />
        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span style={s.label}>⚡&thinsp;{last}/min</span>
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
  },
  svg: { display: 'block' },
  label: {
    fontSize: 10, color: 'var(--accent)', fontFamily: 'monospace',
    fontWeight: 700, flexShrink: 0,
  },
}
