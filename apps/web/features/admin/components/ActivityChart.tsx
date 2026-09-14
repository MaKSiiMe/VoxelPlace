'use client'

import { useEffect, useRef, useState } from 'react'

export interface HourSlot { hour: number; pixels: number; players: number }

const HOUR_MS = 3_600_000

/**
 * Les 24 dernières heures, heure courante comprise, y compris les heures sans
 * activité : le serveur n'en renvoie aucune ligne, et les omettre compresserait
 * l'axe du temps sans que rien ne le signale.
 */
export function fillLast24h(rows: { hour: string; pixels: number; active_players: number }[], now = Date.now()): HourSlot[] {
  const byHour = new Map(rows.map((r) => [Math.floor(new Date(r.hour).getTime() / HOUR_MS), r]))
  const current = Math.floor(now / HOUR_MS)
  return Array.from({ length: 24 }, (_, i) => {
    const h = current - 23 + i
    const row = byHour.get(h)
    return { hour: h * HOUR_MS, pixels: row?.pixels ?? 0, players: row?.active_players ?? 0 }
  })
}

/** Borne haute « ronde » de l'axe : 1, 2 ou 5 × 10ⁿ. */
export function niceMax(value: number): number {
  if (value <= 0) return 10
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return ([1, 2, 5, 10].find((m) => m * magnitude >= value) ?? 10) * magnitude
}

const hourLabel = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const H = 200, PAD_L = 40, PAD_B = 24, PAD_T = 8
const PLOT_H = H - PAD_B - PAD_T

/**
 * Largeur réelle du conteneur. Le graphique est dessiné à l'échelle 1 : mis à
 * l'échelle par viewBox, textes et colonnes grossissaient avec l'écran.
 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** Pixels posés par heure : une seule série, en colonnes. */
export function ActivityChart({ slots }: { slots: HourSlot[] }) {
  const [active, setActive] = useState<number | null>(null)
  const [ref, measured] = useWidth<HTMLDivElement>()
  const W      = Math.max(measured, 280)
  const PLOT_W = W - PAD_L
  // Sur un écran étroit, une étiquette d'heure toutes les 6 colonnes se chevaucherait
  const labelEvery = PLOT_W / slots.length < 16 ? 12 : 6
  const max  = niceMax(Math.max(...slots.map((s) => s.pixels)))
  const band = PLOT_W / slots.length
  const barW = Math.min(24, band - 2)   // colonnes fines, 2 px d'air au minimum
  const y    = (v: number) => PAD_T + PLOT_H - (v / max) * PLOT_H
  const hovered = active !== null ? slots[active] : null

  return (
    <div ref={ref} className="relative">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Pixels posés par heure sur les dernières 24 heures">
        {[0, max / 2, max].map((tick) => (
          <g key={tick}>
            <line x1={PAD_L} x2={W} y1={y(tick)} y2={y(tick)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-fg-subtle)">
              {tick.toLocaleString('fr-FR')}
            </text>
          </g>
        ))}
        {slots.map((s, i) => {
          const x = PAD_L + i * band + (band - barW) / 2
          const top = y(s.pixels)
          const h = PAD_T + PLOT_H - top
          const r = Math.min(4, h)
          return (
            <g key={s.hour}>
              {h > 0 && (
                // Extrémité arrondie de 4 px, base carrée posée sur l'axe
                <path
                  d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                  fill="var(--color-accent)"
                  opacity={active === null || active === i ? 1 : 0.45}
                />
              )}
              {/* Zone de survol : toute la hauteur de la colonne, plus large que la barre */}
              <rect
                x={PAD_L + i * band} y={PAD_T} width={band} height={PLOT_H} fill="transparent"
                tabIndex={0}
                aria-label={`${hourLabel(s.hour)} : ${s.pixels} pixels, ${s.players} joueurs`}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                className="outline-none"
              />
              {i % labelEvery === 0 && (
                <text x={PAD_L + i * band + band / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--color-fg-subtle)">
                  {hourLabel(s.hour)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hovered && active !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-control bg-surface-2 px-2.5 py-1.5 text-xs shadow-float"
          style={{ left: Math.min(Math.max(PAD_L + active * band + band / 2, 70), W - 70) }}
        >
          <p className="font-medium text-fg">{hourLabel(hovered.hour)}</p>
          <p className="text-fg-muted"><span className="font-mono tabular-nums text-fg">{hovered.pixels.toLocaleString('fr-FR')}</span> pixels · {hovered.players} joueurs</p>
        </div>
      )}

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-fg-muted hover:text-fg">Voir les données</summary>
        <div className="mt-2 max-h-60 overflow-y-auto">
          <table className="w-full text-left">
            <thead><tr className="text-xs text-fg-subtle"><th scope="col" className="py-1 font-medium">Heure</th><th scope="col" className="py-1 font-medium">Pixels</th><th scope="col" className="py-1 font-medium">Joueurs</th></tr></thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.hour} className="border-t border-line/60"><td className="py-1 text-fg-muted">{hourLabel(s.hour)}</td><td className="py-1 font-mono tabular-nums text-fg">{s.pixels}</td><td className="py-1 font-mono tabular-nums text-fg">{s.players}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
