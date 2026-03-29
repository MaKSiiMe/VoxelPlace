'use client'

import { useCockpitStore } from '@features/hud/store'
import { cn } from '@shared/lib/utils'
import { Palette, Users, Info } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'selector', icon: Palette, label: 'Couleurs' },
  { id: 'players',  icon: Users,   label: 'Joueurs'  },
  { id: 'info',     icon: Info,    label: 'Info'     },
]

export function SidebarLeft() {
  const activeNavItem    = useCockpitStore((s) => s.activeNavItem)
  const setActiveNavItem = useCockpitStore((s) => s.setActiveNavItem)

  return (
    <aside className="absolute left-0 top-0 bottom-0 w-16 flex flex-col items-center py-6 gap-4 bg-white/5 backdrop-blur-xl border-r border-white/10 pointer-events-auto">
      {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          title={label}
          onClick={() => setActiveNavItem(activeNavItem === id ? null : id)}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-100',
            activeNavItem === id
              ? 'bg-white/15 text-white'
              : 'text-white/40 hover:text-white/80 hover:bg-white/10',
          )}
        >
          <Icon size={18} />
        </button>
      ))}
    </aside>
  )
}
