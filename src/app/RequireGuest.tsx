import { Navigate, Outlet } from 'react-router-dom'
import { useCurrentUser } from '../entities/user'
import { Splash } from './Splash'

// 비로그인 전용 라우트(/login, /signup, /verify-email) — 이미 로그인 상태면 로비로 리다이렉트.
export function RequireGuest() {
  const { session, isLoading } = useCurrentUser()

  if (isLoading) return <Splash />
  if (session) return <Navigate to="/" replace />

  return <Outlet />
}
