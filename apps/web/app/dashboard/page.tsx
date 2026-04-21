import type { Metadata } from 'next'
import { AdminDashboard } from '@features/admin/components/AdminDashboard'
import { AdminGuard } from '@features/admin/guards/AdminGuard'

export const metadata: Metadata = {
  title:       'Dashboard Admin',
  description: 'Panneau d\'administration VoxelPlace.',
  robots:      'noindex, nofollow',
}

export default function DashboardPage() {
  return (
    <AdminGuard>
      <main className="min-h-screen" style={{ background: '#1a1b26' }}>
        <h1 className="sr-only">Dashboard Admin — VoxelPlace</h1>
        <AdminDashboard />
      </main>
    </AdminGuard>
  )
}
