import type { Metadata } from 'next'

// La page est un composant client (la session vit dans le navigateur) : ses
// métadonnées sont portées par ce layout serveur.
export const metadata: Metadata = {
  title:       'Modération',
  description: 'Panneau de modération VoxelPlace.',
  robots:      'noindex, nofollow',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
