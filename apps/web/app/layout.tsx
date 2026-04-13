import type { Metadata } from 'next'
import '@voxelplace/styles/globals.css'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://voxelplace.app'

export const metadata: Metadata = {
  title: {
    default:  'VoxelPlace',
    template: '%s — VoxelPlace',
  },
  description: 'Canvas collaboratif multijoueur en temps réel. Pose des pixels, construis avec d\'autres joueurs.',
  metadataBase: new URL(BASE_URL),
  openGraph: {
    siteName:    'VoxelPlace',
    type:        'website',
    locale:      'fr_FR',
    url:         BASE_URL,
    title:       'VoxelPlace — Canvas collaboratif multijoueur',
    description: 'Pose des pixels sur un canvas géant partagé en temps réel.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'VoxelPlace canvas' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'VoxelPlace',
    description: 'Canvas collaboratif multijoueur en temps réel.',
    images:      ['/og-image.png'],
  },
  canonical: BASE_URL,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
