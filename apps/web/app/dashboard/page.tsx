import { AdminGuard } from '@features/admin/guards/AdminGuard'

export default function DashboardPage() {
  return (
    <AdminGuard>
      <div>Dashboard Admin — TODO</div>
    </AdminGuard>
  )
}
