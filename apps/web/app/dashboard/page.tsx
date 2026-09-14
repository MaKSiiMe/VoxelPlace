'use client'

import { AdminDashboard } from '@features/admin/components/AdminDashboard'
import { AdminGuard } from '@features/admin/guards/AdminGuard'

export default function DashboardPage() {
  return (
    <AdminGuard>
      {(session, logout) => <AdminDashboard session={session} onLogout={logout} />}
    </AdminGuard>
  )
}
