import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../shared/api/supabase'
import { authQueryKeys } from '../entities/user'

// 앱 최상단에서 세션 변경을 구독해 react-query 캐시를 갱신한다 (react-query가 단일 소스).
// 로그인/로그아웃/토큰 갱신 등 모든 auth 이벤트가 여기로 모인다.
export function AuthListener() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(authQueryKeys.session, session)
      queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] })
    })

    return () => subscription.unsubscribe()
  }, [queryClient])

  return null
}
