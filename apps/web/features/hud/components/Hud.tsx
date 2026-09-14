'use client'

import { useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useHudStore } from '../store'
import { useCanvasStore } from '@features/canvas/store'
import { Brand, CoordinatesPill } from './TopBar'
import { Toolbar } from './Toolbar'
import { PaletteDock } from './PaletteDock'
import { ViewCluster } from './ViewCluster'
import { useUnlocksStore } from '@features/unlocks/store'
import { useUnlocksSync } from '@features/unlocks/hooks/useUnlocksSync'
import { lockedColorsFrom } from '@features/unlocks/progress'

const HelpDialog        = dynamic(() => import('./HelpDialog').then(m => ({ default: m.HelpDialog })),               { ssr: false })
const SettingsDialog    = dynamic(() => import('./SettingsDialog').then(m => ({ default: m.SettingsDialog })),       { ssr: false })
const LeaderboardDialog = dynamic(() => import('./LeaderboardDialog').then(m => ({ default: m.LeaderboardDialog })), { ssr: false })
const StatsDialog       = dynamic(() => import('./StatsDialog').then(m => ({ default: m.StatsDialog })),             { ssr: false })
const UnlockPanel       = dynamic(() => import('@features/unlocks/components/UnlockPanel').then(m => ({ default: m.UnlockPanel })), { ssr: false })

interface Props {
  username:   string
  onOpenAuth: () => void
  onLogout:   () => void
}

/**
 * Interface de jeu : des panneaux flottants posés sur un canvas plein écran.
 *
 * Remplace le « bezel » — un cadre SVG décoratif avec dock latéral et encoche —
 * qui prenait de la place, ne s'adaptait pas au mobile et cachait la palette.
 */
export function Hud({ username, onOpenAuth, onLogout }: Props) {
  const panel      = useHudStore((s) => s.panel)
  const closePanel = useHudStore((s) => s.closePanel)
  const colors     = useUnlocksStore((s) => s.colors)
  const lockedColors = useMemo(() => lockedColorsFrom(colors), [colors])
  useUnlocksSync()
  useEscapeReturnsToExploration()

  return (
    <>
      {/* Haut : identité et coordonnées */}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-30 flex items-start justify-between gap-3">
        <div className="pointer-events-auto"><Brand /></div>
        <div className="pointer-events-auto hidden md:block"><CoordinatesPill /></div>
        {/* Sur mobile, la barre d'outils se range en haut à droite */}
        <div className="pointer-events-auto md:hidden"><Toolbar /></div>
        <div className="hidden w-[180px] md:block" aria-hidden="true" />
      </div>

      {/* Barre d'outils verticale sur grand écran */}
      <div className="fixed left-3 top-1/2 z-30 hidden -translate-y-1/2 md:block">
        <Toolbar />
      </div>

      {/* Bas : palette au centre, vue à droite */}
      <div className="pointer-events-none fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 flex flex-col items-center gap-3 md:flex-row md:items-end md:justify-center">
        <div className="pointer-events-auto order-2 md:order-1"><PaletteDock onOpenAuth={onOpenAuth} lockedColors={lockedColors} /></div>
        <div className="pointer-events-auto order-1 self-end md:absolute md:right-0 md:bottom-0 md:order-2">
          <ViewCluster />
        </div>
      </div>

      {/* Montées en permanence : fermer un <dialog> via close() rend le focus au bouton qui l'a ouvert */}
      <UnlockPanel       open={panel === 'unlocks'}     onClose={closePanel} />
      <LeaderboardDialog open={panel === 'leaderboard'} onClose={closePanel} />
      <StatsDialog       open={panel === 'stats'}       onClose={closePanel} username={username} />
      <HelpDialog        open={panel === 'help'}        onClose={closePanel} />
      <SettingsDialog    open={panel === 'settings'}    onClose={closePanel} username={username} onLogout={onLogout} onOpenAuth={onOpenAuth} />
    </>
  )
}

/**
 * Échap quitte le mode Build — sauf si un panneau est ouvert, qu'Échap ferme en
 * priorité, ou si la palette détaille une couleur verrouillée : Échap referme
 * d'abord ce détail.
 */
export function useEscapeReturnsToExploration() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const { panel, lockedHint, setLockedHint } = useHudStore.getState()
      if (panel) return
      if (lockedHint !== null) return setLockedHint(null)
      const { selectedColor, setSelectedColor, inspectedPixel } = useCanvasStore.getState()
      if (inspectedPixel) return   // l'inspecteur gère sa propre fermeture
      if (selectedColor !== null) setSelectedColor(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
