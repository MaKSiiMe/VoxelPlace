import type { Metadata } from 'next'
import { AdminGuard } from '@features/admin/guards/AdminGuard'

export const metadata: Metadata = {
  title:       'Dashboard Admin',
  description: 'Panneau d\'administration VoxelPlace.',
  robots:      'noindex, nofollow',
}

export default function DashboardPage() {
  return (
    <AdminGuard>
      <main>
        <h1 className="sr-only">Dashboard Admin — VoxelPlace</h1>
        <div>Dashboard Admin — TODO</div>
      </main>
    </AdminGuard>
  )
}
