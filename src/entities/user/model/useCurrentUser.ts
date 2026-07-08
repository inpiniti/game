import { useQuery } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../shared/api/supabase'
import type { Profile } from './types'

// react-query 쿼리키 — app/AuthListener.tsx가 onAuthStateChange 시 이 키로 캐시를 갱신한다.
export const authQueryKeys = {
  session: ['auth', 'session'] as const,
  profile: (userId: string) => ['auth', 'profile', userId] as const,
}

function useSessionQuery() {
  return useQuery({
    queryKey: authQueryKeys.session,
    queryFn: async (): Promise<Session | null> => {
      const { data, error } = await supabase.auth.getSession()
      // 유효하지 않은 세션(예: 삭제된 계정의 리프레시 실패)은 로그아웃 상태로 취급한다.
      if (error) return null
      return data.session
    },
    // 값 자체는 app/AuthListener.tsx의 onAuthStateChange 구독이 최신으로 유지한다.
    staleTime: Infinity,
  })
}

function useProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: authQueryKeys.profile(userId ?? 'anonymous'),
    queryFn: async (): Promise<Profile | null> => {
      if (!userId) return null
      // maybeSingle: 행이 없으면 에러 대신 null (계정 삭제/프로필 미생성 감지용). 실제 오류만 throw.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, country, role')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      return (data as Profile | null) ?? null
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

export interface CurrentUser {
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  /** 세션(및 로그인 상태면 프로필)을 아직 불러오는 중이면 true — 가드에서 스플래시 표시용. */
  isLoading: boolean
  /** 세션은 있는데 profiles 행이 없음(계정 삭제/프로필 미생성). SessionGuard가 자동 로그아웃한다. */
  profileMissing: boolean
}

/**
 * 현재 로그인 세션 + profiles row를 함께 반환한다. 세션이 없으면 profile도 null.
 * 세션 변경은 app/AuthListener.tsx가 구독해 react-query 캐시를 무효화하므로
 * 이 훅은 어디서 호출해도 항상 최신 상태를 본다.
 */
export function useCurrentUser(): CurrentUser {
  const sessionQuery = useSessionQuery()
  const session = sessionQuery.data ?? null
  const userId = session?.user.id

  const profileQuery = useProfileQuery(userId)
  const profile = profileQuery.data ?? null

  return {
    session,
    profile,
    isAdmin: profile?.role === 'admin',
    isLoading: sessionQuery.isPending || (!!userId && profileQuery.isPending),
    // 조회가 성공했는데 행이 없을 때만 true (네트워크 오류는 isSuccess=false라 제외 → 오탐 방지).
    profileMissing: !!userId && profileQuery.isSuccess && profile === null,
  }
}
