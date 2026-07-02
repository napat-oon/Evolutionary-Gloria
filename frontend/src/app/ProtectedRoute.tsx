import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <main className="page">Loading…</main>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
