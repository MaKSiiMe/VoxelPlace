import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'VoxelPlace',
  description: 'Pose des pixels sur un canvas géant partagé en temps réel avec des milliers de joueurs.',
  openGraph: {
    title:       'VoxelPlace — Canvas collaboratif multijoueur',
    description: 'Pose des pixels sur un canvas géant partagé en temps réel.',
    url:         '/',
  },
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
