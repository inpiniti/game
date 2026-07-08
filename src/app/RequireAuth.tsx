import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../entities/user'
import { Splash } from './Splash'

// 세션 없으면 /login으로 리다이렉트 (원래 가려던 경로를 state.from에 담아, 로그인 후 되돌아갈 수 있게 한다).
export function RequireAuth() {
  const { session, isLoading } = useCurrentUser()
  const location = useLocation()

  if (isLoading) return <Splash />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <Outlet />
}
