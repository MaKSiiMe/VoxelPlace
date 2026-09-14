'use client'

import dynamic from 'next/dynamic'
import { useHudStore } from '../store'
import { zoomBy, recenterView } from '@features/canvas/viewportState'
import { useMediaQuery } from '@shared/useMediaQuery'
import { IconButton, Surface, PlusIcon, MinusIcon, LocateIcon, MapIcon } from '@shared/ui'
import { HeatmapPanel, HeatmapToggle } from '@features/heatmap/components/HeatmapPanel'
import { useHeatmapStore } from '@features/heatmap/store'
import { cn } from '@shared/ui'

const Minimap = dynamic(
  () => import('@features/canvas/components/Minimap').then((m) => ({ default: m.Minimap })),
  { ssr: false },
)

/** Minimap, heatmap et contrôles de vue. Le zoom au bouton double le pincement et la molette. */
export function ViewCluster() {
  const minimapOpen    = useHudStore((s) => s.minimapOpen)
  const setMinimapOpen = useHudStore((s) => s.setMinimapOpen)
  const wide           = useMediaQuery('(min-width: 768px)')
  const heatmapOpen    = useHeatmapStore((s) => s.enabled)

  return (
    <Surface className={cn('flex flex-col overflow-hidden', heatmapOpen && 'w-[min(256px,calc(100vw-24px))]')}>
      <HeatmapPanel />
      {/* Panneau de heatmap ouvert : la minimap s'élargit à sa largeur au lieu de rester calée à gauche */}
      {wide && minimapOpen && <div className={cn(heatmapOpen && '[&>canvas]:size-64')}><Minimap /></div>}
      <div className="flex items-center justify-between gap-0.5 p-1">
        <IconButton label="Dézoomer"          icon={<MinusIcon />}  size="sm" tooltipSide="top" onClick={() => zoomBy(1 / 1.5)} />
        <IconButton label="Zoomer"            icon={<PlusIcon />}   size="sm" tooltipSide="top" onClick={() => zoomBy(1.5)} />
        <IconButton label="Recentrer la vue"  icon={<LocateIcon />} size="sm" tooltipSide="top" onClick={recenterView} />
        <HeatmapToggle />
        {wide && (
          <IconButton
            label={minimapOpen ? 'Masquer la minimap' : 'Afficher la minimap'}
            icon={<MapIcon />}
            size="sm"
            tooltipSide="top"
            pressed={minimapOpen}
            onClick={() => setMinimapOpen(!minimapOpen)}
          />
        )}
      </div>
    </Surface>
  )
}
