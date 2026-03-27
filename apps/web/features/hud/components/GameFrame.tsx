'use client'

import { SidebarLeft } from './SidebarLeft'
import { ColorDock } from './ColorDock'
import { StatusPills } from './StatusPills'

// Cadre fixe qui entoure le canvas central : header, sidebars, footer en continu
export function GameFrame() {
  return (
    <div className="fixed inset-6 rounded-[48px] border border-white/10 pointer-events-none z-10 overflow-hidden">
      {/* Contenu pointer-events-auto pour les éléments interactifs */}
      <div className="pointer-events-auto">
        <StatusPills />
        <SidebarLeft />
        <ColorDock />
      </div>
    </div>
  )
}
