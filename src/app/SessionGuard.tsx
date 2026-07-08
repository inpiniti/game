import { useEffect } from 'react'
import { supabase } from '../shared/api/supabase'
import { useCurrentUser } from '../entities/user'

// 세션은 있는데 profiles 행이 없으면(계정 삭제·프로필 미생성 등) 유효하지 않은 세션이므로
// 자동 로그아웃해 로그인 화면으로 보낸다 — 로딩 화면에서 멈추는 것을 방지.
// signOut → onAuthStateChange → AuthListener가 세션 캐시를 비움 → RequireAuth가 /login으로 보낸다.
export function SessionGuard() {
  const { session, profileMissing } = useCurrentUser()

  useEffect(() => {
    if (session && profileMissing) {
      void supabase.auth.signOut()
    }
  }, [session, profileMissing])

  return null
}
