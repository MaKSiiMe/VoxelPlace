import type { Metadata } from 'next'
import '@voxelplace/styles/globals.css'

export const metadata: Metadata = {
  title: 'VoxelPlace',
  description: 'Canvas collaboratif multijoueur en temps réel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
