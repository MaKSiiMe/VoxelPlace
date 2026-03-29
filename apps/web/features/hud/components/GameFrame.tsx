'use client'

import { useEffect, useState } from 'react'

const THIN    = 12
const TASKBAR = 64
const RADIUS  = 24

// Génère un chemin SVG : rectangle plein avec un trou arrondi au centre
function bezelPath(w: number, h: number): string {
  const x = TASKBAR, y = THIN
  const iw = w - TASKBAR - THIN, ih = h - THIN * 2
  const r  = RADIUS
  // Rect extérieur + trou avec arcs circulaires (= identique à CSS border-radius)
  return [
    `M0,0 H${w} V${h} H0 Z`,
    `M${x + r},${y}`,
    `H${x + iw - r} A${r},${r} 0 0 1 ${x + iw},${y + r}`,
    `V${y + ih - r} A${r},${r} 0 0 1 ${x + iw - r},${y + ih}`,
    `H${x + r}      A${r},${r} 0 0 1 ${x},${y + ih - r}`,
    `V${y + r}       A${r},${r} 0 0 1 ${x + r},${y} Z`,
  ].join(' ')
}

export function GameFrame() {
  const [vp, setVp] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const { w, h } = vp
  const maskSvg  = w && h
    ? `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><path fill-rule='evenodd' d='${bezelPath(w, h)}' fill='black'/></svg>")`
    : 'none'

  return (
    <>
      {/* Glassmorphism bezel — backdrop-blur sur la zone du cadre uniquement */}
      <div
        className="fixed inset-0 z-20 pointer-events-none"
        style={{
          backdropFilter:       'blur(8px) saturate(142%) brightness(1.05)',
          WebkitBackdropFilter: 'blur(8px) saturate(160%) brightness(1.05)',
          backgroundColor:      'rgba(232, 227, 222, 0.32)',
          maskImage:            maskSvg,
          WebkitMaskImage:      maskSvg,
        }}
      />

      {/* Reflet interne — fine ligne blanche sur le bord de l'ouverture */}
      <div
        className="fixed z-21 pointer-events-none"
        style={{
          top:          THIN,
          right:        THIN,
          bottom:       THIN,
          left:         TASKBAR,
          borderRadius: RADIUS,
          border:       '1px solid rgba(255,255,255,0.55)',
          boxShadow:    'inset 0 0 8px rgba(0,0,0,0.64)',
        }}
      />

      {/* Taskbar gauche */}
      <div
        className="fixed top-0 left-0 bottom-0 z-30 flex flex-col items-center pointer-events-auto"
        style={{ width: TASKBAR }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center mt-4" style={{ width: 40, height: 40 }}>
          <div className="rounded-lg bg-black/10 border border-black/20 flex items-center justify-center" style={{ width: 36, height: 36 }}>
            <span className="text-black/70 font-bold text-sm">VP</span>
          </div>
        </div>

        {/* Nom du site — vertical au centre */}
        <div className="flex-1 flex items-center justify-center">
          <span
            className="text-black/40 font-semibold tracking-widest text-xs select-none"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.2em' }}
          >
            VoxelPlace
          </span>
        </div>

        {/* Boutons bas */}
        <div className="flex flex-col items-center gap-3 mb-4">
          {/* Support */}
          <button
            className="flex items-center justify-center rounded-lg text-black/40 hover:text-black/70 hover:bg-black/10 transition-colors"
            style={{ width: 36, height: 36 }}
            title="Support"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <circle cx="12" cy="17" r=".5" fill="currentColor"/>
            </svg>
          </button>

          {/* Paramètres */}
          <button
            className="flex items-center justify-center rounded-lg text-black/40 hover:text-black/70 hover:bg-black/10 transition-colors"
            style={{ width: 36, height: 36 }}
            title="Paramètres"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
