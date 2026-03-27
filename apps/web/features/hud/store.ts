import { create } from 'zustand'

interface CockpitStore {
  isSidebarOpen: boolean
  isRightPanelOpen: boolean
  activeNavItem: string | null
  toggleSidebar: () => void
  toggleRightPanel: () => void
  setActiveNavItem: (item: string | null) => void
}

export const useCockpitStore = create<CockpitStore>((set) => ({
  isSidebarOpen: true,
  isRightPanelOpen: false,
  activeNavItem: 'selector',
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  toggleRightPanel: () => set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),
  setActiveNavItem: (activeNavItem) => set({ activeNavItem }),
}))
