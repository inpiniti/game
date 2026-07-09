import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import { useCurrentUser } from '../../user'
import { DEFAULT_PLAYER_STATS, type PlayerStats } from './types'

// save-session이 apply_game_result RPC 성공 후 이 키로 무효화해 게임 후 스탯을 갱신한다
// (entities/user의 authQueryKeys.profile 패턴과 동일 — 유저 식별을 키에 넣어 로그인 전환 시 캐시 분리).
export const playerStatsQueryKeys = {
  detail: (userId: string) => ['player-stats', userId] as const,
}

export interface UseUserStatsResult {
  stats: PlayerStats
  // 최초 조회가 아직 성공/실패 어느 쪽으로도 끝나지 않음. 실패해도 곧 false로 풀리므로
  // (react-query isPending은 성공·실패 둘 다에서 false가 된다) 이 값을 게이트로 써도
  // 무한 대기하지 않는다 — 행이 없거나 조회가 실패해도 DEFAULT_PLAYER_STATS로 진행 가능
  // (설계 v10 §17-1: 스탯 로딩을 치명적 게이트로 만들지 말 것).
  isLoading: boolean
}

// 현재 유저의 user_stats 행을 읽는다(설계 v10 §16-1·§18-2). 행이 없으면(구세션·백필 전 신규
// 유저) DEFAULT_PLAYER_STATS로 폴백한다. 쓰기는 이 훅의 책임이 아니다 — user_stats는 직접
// insert/update grant가 없고 오직 apply_game_result RPC(security definer)만 갱신한다.
export function useUserStats(): UseUserStatsResult {
  const { session } = useCurrentUser()
  const userId = session?.user.id

  const query = useQuery({
    queryKey: playerStatsQueryKeys.detail(userId ?? 'anonymous'),
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<PlayerStats> => {
      // maybeSingle: 행이 없으면 에러 대신 null (신규 유저 백필 전 등) — 아래서 기본값으로 폴백.
      const { data, error } = await supabase
        .from('user_stats')
        .select('level, exp, str, agi, sta, unspent')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return (data as PlayerStats | null) ?? DEFAULT_PLAYER_STATS
    },
  })

  return {
    stats: query.data ?? DEFAULT_PLAYER_STATS,
    isLoading: query.isPending,
  }
}
