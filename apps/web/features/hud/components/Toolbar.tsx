'use client'

import { useCanvasStore } from '@features/canvas/store'
import { useHudStore, type PanelId } from '../store'
import { useMediaQuery } from '@shared/useMediaQuery'
import {
  IconButton, IconLink, Surface,
  TrophyIcon, ChartIcon, FilmIcon, TreeIcon, HelpIcon, SettingsIcon, ShieldIcon, EyeIcon, BrushIcon,
} from '@shared/ui'

const TOOLS: { id: PanelId; label: string; icon: React.ReactNode; needsAccount?: boolean }[] = [
  { id: 'leaderboard', label: 'Classement',   icon: <TrophyIcon /> },
  { id: 'stats',       label: 'Mes stats',    icon: <ChartIcon />, needsAccount: true },
  { id: 'timelapse',   label: 'Timelapse',    icon: <FilmIcon />,  needsAccount: true },
  { id: 'unlocks',     label: 'Progression',  icon: <TreeIcon />,  needsAccount: true },
  { id: 'help',        label: 'Aide',         icon: <HelpIcon /> },
  { id: 'settings',    label: 'Paramètres',   icon: <SettingsIcon /> },
]

export function Toolbar() {
  const panel       = useHudStore((s) => s.panel)
  const togglePanel = useHudStore((s) => s.togglePanel)
  const role        = useCanvasStore((s) => s.role)
  const isEditMode  = useCanvasStore((s) => s.isEditMode)
  const isAdmin     = role === 'admin' || role === 'superadmin'
  const wide        = useMediaQuery('(min-width: 768px)')
  const side        = wide ? 'right' : 'bottom'

  return (
    <nav aria-label="Outils">
      <Surface className="flex flex-row gap-1 p-1 md:flex-col md:p-1.5">
        {TOOLS.filter(t => !t.needsAccount || role).map((t) => (
          <IconButton
            key={t.id}
            label={t.label}
            icon={t.icon}
            pressed={panel === t.id}
            tooltipSide={side}
            onClick={() => togglePanel(t.id)}
          />
        ))}
        {isAdmin && (
          <>
            <span className="mx-1 w-px self-stretch bg-line md:mx-0 md:my-1 md:h-px md:w-auto" aria-hidden="true" />
            <IconButton
              label={isEditMode ? 'Passer en mode spectateur' : 'Repasser en mode édition'}
              icon={isEditMode ? <BrushIcon /> : <EyeIcon />}
              pressed={!isEditMode}
              tooltipSide={side}
              onClick={() => {
                const { setIsEditMode, setSelectedColor } = useCanvasStore.getState()
                setIsEditMode(!isEditMode)
                if (isEditMode) setSelectedColor(null)
              }}
            />
            <IconLink label="Administration" icon={<ShieldIcon />} href="/dashboard" />
          </>
        )}
      </Surface>
    </nav>
  )
}
