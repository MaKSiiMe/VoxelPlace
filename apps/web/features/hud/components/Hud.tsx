'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useHudStore } from '../store'
import { useCanvasStore } from '@features/canvas/store'
import { Brand, CoordinatesPill } from './TopBar'
import { Toolbar } from './Toolbar'
import { PaletteDock } from './PaletteDock'
import { ViewCluster } from './ViewCluster'

const SupportModal     = dynamic(() => import('./SupportModal').then(m => ({ default: m.SupportModal })),         { ssr: false })
const SettingsModal    = dynamic(() => import('./SettingsModal').then(m => ({ default: m.SettingsModal })),       { ssr: false })
const LeaderboardModal = dynamic(() => import('./LeaderboardModal').then(m => ({ default: m.LeaderboardModal })), { ssr: false })
const StatsModal       = dynamic(() => import('./StatsModal').then(m => ({ default: m.StatsModal })),             { ssr: false })
const UnlockPanel      = dynamic(() => import('@features/unlocks/components/UnlockPanel').then(m => ({ default: m.UnlockPanel })), { ssr: false })

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
        <div className="pointer-events-auto order-2 md:order-1"><PaletteDock onOpenAuth={onOpenAuth} /></div>
        <div className="pointer-events-auto order-1 self-end md:absolute md:right-0 md:bottom-0 md:order-2">
          <ViewCluster />
        </div>
      </div>

      {/* Monté seulement ouvert : fermé, il dépassait de 12 px au bord droit et ses boutons restaient atteignables au clavier */}
      {panel === 'unlocks' && <UnlockPanel open onClose={closePanel} />}
      {panel === 'leaderboard' && <LeaderboardModal onClose={closePanel} />}
      {panel === 'stats'       && <StatsModal username={username} onClose={closePanel} />}
      {panel === 'help'        && <SupportModal onClose={closePanel} />}
      {panel === 'settings'    && <SettingsModal username={username} onClose={closePanel} onLogout={onLogout} />}
    </>
  )
}

/** Échap quitte le mode Build — sauf si un panneau est ouvert, qu'Échap ferme en priorité. */
function useEscapeReturnsToExploration() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useHudStore.getState().panel) return
      const { selectedColor, setSelectedColor, inspectedPixel } = useCanvasStore.getState()
      if (inspectedPixel) return   // l'inspecteur gère sa propre fermeture
      if (selectedColor !== null) setSelectedColor(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
