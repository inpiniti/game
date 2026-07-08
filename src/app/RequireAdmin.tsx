import { Navigate, Outlet } from 'react-router-dom'
import { useCurrentUser } from '../entities/user'
import { Splash } from './Splash'

// RequireAuth 안쪽에서만 쓰인다 — 세션은 이미 보장된 상태로 role만 확인.
export function RequireAdmin() {
  const { isAdmin, isLoading } = useCurrentUser()

  if (isLoading) return <Splash />
  if (!isAdmin) return <Navigate to="/" replace />

  return <Outlet />
}
