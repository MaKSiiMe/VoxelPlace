'use client'

import { useEffect, useRef, useState } from 'react'
import { HUD_SHADOW, THIN, TASKBAR, RADIUS, BORDER_COLOR, ACCENT_RED, ACCENT_GREEN } from '../theme'
import { NOTCH_W, NOTCH_H, NOTCH_R } from './Notch'
import { useCanvasStore } from '@features/canvas/store'
import { SupportModal }      from './SupportModal'
import { SettingsModal }     from './SettingsModal'
import { LeaderboardModal }  from './LeaderboardModal'
import { StatsModal }        from './StatsModal'
import { UnlockPanel }       from '@features/unlocks/components/UnlockPanel'

const ACCENT_BLUE   = '#7aa2f7'
const ACCENT_YELLOW = '#e0af68'

function hexToRgb(hex: string) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function interpolateColor(progress: number): string {
  const [r1, g1, b1] = hexToRgb(ACCENT_RED)
  const [r2, g2, b2] = hexToRgb(ACCENT_GREEN)
  const r = Math.round(r1 * (1 - progress) + r2 * progress)
  const g = Math.round(g1 * (1 - progress) + g2 * progress)
  const b = Math.round(b1 * (1 - progress) + b2 * progress)
  return `rgb(${r},${g},${b})`
}

function outerPath(w: number, h: number): string {
  return `M0,0 H${w} V${h} H0 Z`
}

// Bordure intérieure du bezel avec la notch intégrée au centre du bord haut
function innerPath(w: number, h: number): string {
  const x  = TASKBAR, y = THIN
  const iw = w - TASKBAR - THIN, ih = h - THIN * 2
  const r  = RADIUS

  const nx  = Math.round(w / 2 - NOTCH_W / 2)  // bord gauche notch (coords écran)
  const nh  = NOTCH_H
  const nr  = NOTCH_R

  return [
    // Départ coin haut-gauche
    `M${x + r},${y}`,
    // Bord haut jusqu'à la notch
    `H${nx}`,
    // Descente gauche de la notch
    `Q${nx + nr},${y} ${nx + nr},${y + nh - nr}`,
    `Q${nx + nr},${y + nh} ${nx + nr * 2},${y + nh}`,
    // Fond de la notch
    `H${nx + NOTCH_W - nr * 2}`,
    // Remontée droite de la notch
    `Q${nx + NOTCH_W - nr},${y + nh} ${nx + NOTCH_W - nr},${y + nh - nr}`,
    `Q${nx + NOTCH_W - nr},${y} ${nx + NOTCH_W},${y}`,
    // Suite du bord haut jusqu'au coin haut-droit
    `H${x + iw - r} A${r},${r} 0 0 1 ${x + iw},${y + r}`,
    // Bord droit
    `V${y + ih - r} A${r},${r} 0 0 1 ${x + iw - r},${y + ih}`,
    // Bord bas
    `H${x + r} A${r},${r} 0 0 1 ${x},${y + ih - r}`,
    // Bord gauche
    `V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`,
  ].join(' ')
}

interface Props {
  username:  string
  onLogout:  () => void
}

export function GameFrame({ username, onLogout }: Props) {
  const [vp, setVp]             = useState({ w: 0, h: 0 })
  const [borderColor, setBorderColor] = useState(BORDER_COLOR)
  const [glowBlur, setGlowBlur] = useState(2)
  const [showSupport,      setShowSupport]      = useState(false)
  const [showSettings,     setShowSettings]     = useState(false)
  const [showUnlocks,      setShowUnlocks]      = useState(false)
  const [showLeaderboard,  setShowLeaderboard]  = useState(false)
  const [showStats,        setShowStats]        = useState(false)
  const rafRef = useRef<number>(0)

  const role          = useCanvasStore((s) => s.role)
  const isEditMode    = useCanvasStore((s) => s.isEditMode)
  const setIsEditMode = useCanvasStore((s) => s.setIsEditMode)
  const setSelected   = useCanvasStore((s) => s.setSelectedColor)
  const isAdmin       = role === 'admin'  || role === 'superadmin'

  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const loop = () => {
      const { cooldownEnd, cooldownDuration } = useCanvasStore.getState()
      if (cooldownEnd && cooldownDuration > 0) {
        const remaining = cooldownEnd - Date.now()
        if (remaining > 0) {
          const p = 1 - remaining / cooldownDuration
          setBorderColor(interpolateColor(p))
          setGlowBlur(4 + p * 8)
        } else {
          setBorderColor(BORDER_COLOR)
          setGlowBlur(2)
        }
      } else {
        setBorderColor(BORDER_COLOR)
        setGlowBlur(2)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const { w, h } = vp
  if (!w || !h) return null

  return (
    <>
      {/* ── Bezel + Notch — un seul SVG, une seule ombre ── */}
      <svg
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 20, filter: HUD_SHADOW }}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
      >
        <defs>
          <filter id="border-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={glowBlur} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Surface bezel */}
        <path
          fillRule="evenodd"
          d={`${outerPath(w, h)} ${innerPath(w, h)}`}
          fill="#24283b"
        />
        {/* Bordure avec glow */}
        <path
          d={innerPath(w, h)}
          fill="none"
          stroke={borderColor}
          strokeWidth="1"
          filter="url(#border-glow)"
        />
      </svg>

      {/* ── Dock gauche ── */}
      <div
        className="fixed top-0 left-0 bottom-0 z-30 flex flex-col items-center pointer-events-auto"
        style={{ width: TASKBAR }}
      >
        <div className="flex items-center justify-center mt-4" style={{ width: 40, height: 40 }}>
          <div
            className="rounded-lg flex items-center justify-center"
            style={{ width: 36, height: 36, background: '#1a1b26', border: '1px solid #414868' }}
          >
            <span style={{ color: '#7aa2f7', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>VP</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <span style={{
            writingMode: 'vertical-rl', textOrientation: 'mixed',
            letterSpacing: '0.2em', fontSize: 11, fontWeight: 600,
            color: BORDER_COLOR, fontFamily: 'monospace', userSelect: 'none',
          }}>
            VoxelPlace
          </span>
        </div>

        <div className="flex flex-col items-center gap-3 mb-4">
          {/* Bouton Leaderboard */}
          <button
            onClick={() => setShowLeaderboard(v => !v)}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 36, height: 36,
              background: showLeaderboard ? `${ACCENT_YELLOW}22` : 'transparent',
              border:     showLeaderboard ? `1px solid ${ACCENT_YELLOW}` : '1px solid transparent',
              color:      showLeaderboard ? ACCENT_YELLOW : BORDER_COLOR,
              transition: 'background 150ms, border-color 150ms, color 150ms',
            }}
            onMouseEnter={e => { if (!showLeaderboard) e.currentTarget.style.color = ACCENT_YELLOW }}
            onMouseLeave={e => { if (!showLeaderboard) e.currentTarget.style.color = BORDER_COLOR }}
            title="Leaderboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </button>

          {/* Bouton Stats joueur */}
          <button
            onClick={() => setShowStats(v => !v)}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 36, height: 36,
              background: showStats ? `${ACCENT_BLUE}22` : 'transparent',
              border:     showStats ? `1px solid ${ACCENT_BLUE}` : '1px solid transparent',
              color:      showStats ? ACCENT_BLUE : BORDER_COLOR,
              transition: 'background 150ms, border-color 150ms, color 150ms',
            }}
            onMouseEnter={e => { if (!showStats) e.currentTarget.style.color = ACCENT_BLUE }}
            onMouseLeave={e => { if (!showStats) e.currentTarget.style.color = BORDER_COLOR }}
            title="Mes stats"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
          </button>

          {/* Bouton Arbre de compétences */}
          <button
            onClick={() => setShowUnlocks(v => !v)}
            className="flex items-center justify-center rounded-lg"
            style={{
              width:      36,
              height:     36,
              background: showUnlocks ? `${ACCENT_BLUE}22` : 'transparent',
              border:     showUnlocks ? `1px solid ${ACCENT_BLUE}` : '1px solid transparent',
              color:      showUnlocks ? ACCENT_BLUE : BORDER_COLOR,
              transition: 'background 150ms, border-color 150ms, color 150ms',
            }}
            onMouseEnter={e => { if (!showUnlocks) { e.currentTarget.style.color = ACCENT_BLUE } }}
            onMouseLeave={e => { if (!showUnlocks) { e.currentTarget.style.color = BORDER_COLOR } }}
            title="Arbre de compétences"
          >
            {/* Tree icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>

          {/* Bouton Edit / Spec — visible uniquement pour les admins */}
          {isAdmin && (
            <button
              onClick={() => {
                const next = !isEditMode
                setIsEditMode(next)
                if (!next) setSelected(null)
              }}
              title={isEditMode ? 'Passer en mode Spec' : 'Passer en mode Edit'}
              className="flex items-center justify-center rounded-lg"
              style={{
                width:      36,
                height:     36,
                background: isEditMode ? `${ACCENT_BLUE}22` : `${ACCENT_YELLOW}22`,
                border:     `1px solid ${isEditMode ? ACCENT_BLUE : ACCENT_YELLOW}`,
                color:      isEditMode ? ACCENT_BLUE : ACCENT_YELLOW,
                transition: 'background 150ms, border-color 150ms, color 150ms',
              }}
            >
              {isEditMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          )}

          <button
            onClick={() => setShowSupport(true)}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 36, height: 36, color: BORDER_COLOR, background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#7aa2f7')}
            onMouseLeave={e => (e.currentTarget.style.color = BORDER_COLOR)}
            title="Support"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 36, height: 36, color: BORDER_COLOR, background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#7aa2f7')}
            onMouseLeave={e => (e.currentTarget.style.color = BORDER_COLOR)}
            title="Paramètres"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      <UnlockPanel open={showUnlocks} onClose={() => setShowUnlocks(false)} />
      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}
      {showStats       && <StatsModal username={username} onClose={() => setShowStats(false)} />}
      {showSupport     && <SupportModal  onClose={() => setShowSupport(false)} />}
      {showSettings    && <SettingsModal username={username} onClose={() => setShowSettings(false)} onLogout={onLogout} />}
    </>
  )
}
