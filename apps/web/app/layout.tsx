import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import '@voxelplace/styles/globals.css'
import { CookieBanner } from '@features/rgpd/CookieBanner'

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
  alternates: { canonical: BASE_URL },
}

// Le zoom du navigateur reste autorisé : l'interdire empêcherait d'agrandir
// le texte (WCAG 1.4.4). C'est le canvas seul qui capte les gestes, via
// « touch-action: none » sur son conteneur.
export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  viewportFit:  'cover',
  themeColor:   '#13141c',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <CookieBanner />
      </body>
    </html>
  )
}
