'use client'

import dynamic from 'next/dynamic'
import { useHudStore } from '../store'
import { zoomBy, recenterView } from '@features/canvas/viewportState'
import { useMediaQuery } from '@shared/useMediaQuery'
import { IconButton, Surface, PlusIcon, MinusIcon, LocateIcon, MapIcon } from '@shared/ui'

const Minimap = dynamic(
  () => import('@features/canvas/components/Minimap').then((m) => ({ default: m.Minimap })),
  { ssr: false },
)

/** Minimap et contrôles de vue. Le zoom au bouton double le pincement et la molette. */
export function ViewCluster() {
  const minimapOpen    = useHudStore((s) => s.minimapOpen)
  const setMinimapOpen = useHudStore((s) => s.setMinimapOpen)
  const wide           = useMediaQuery('(min-width: 768px)')

  return (
    <Surface className="flex flex-col overflow-hidden">
      {wide && minimapOpen && <Minimap />}
      <div className="flex items-center justify-between gap-0.5 p-1">
        <IconButton label="Dézoomer"          icon={<MinusIcon />}  size="sm" tooltipSide="top" onClick={() => zoomBy(1 / 1.5)} />
        <IconButton label="Zoomer"            icon={<PlusIcon />}   size="sm" tooltipSide="top" onClick={() => zoomBy(1.5)} />
        <IconButton label="Recentrer la vue"  icon={<LocateIcon />} size="sm" tooltipSide="top" onClick={recenterView} />
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
