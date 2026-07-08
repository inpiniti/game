import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import { useCurrentUser } from '../../user'
import type { PlayHistory, PlayHistoryWithSet } from './types'

export const playHistoriesQueryKey = ['play-histories'] as const

interface RawPlayHistoryRow extends PlayHistory {
  quiz_sets: { title: string } | null
}

// 기록 `/history` 용 — 현재 유저의 play_histories를 최근순으로 가져온다. RLS("own histories")가
// 본인 것만 보장하므로 별도 필터는 없지만, 쿼리 키에 유저 식별을 넣어 로그인 전환 시 캐시를 분리한다.
// quiz_sets(title) 조인으로 문제집 제목을 함께 받는다 — 문제집이 삭제됐으면(quiz_set_id null) null.
export function usePlayHistories() {
  const { session } = useCurrentUser()
  const userId = session?.user.id

  return useQuery({
    queryKey: [...playHistoriesQueryKey, userId],
    enabled: !!userId,
    queryFn: async (): Promise<PlayHistoryWithSet[]> => {
      const { data, error } = await supabase
        .from('play_histories')
        .select(
          'id, user_id, quiz_set_id, game_type, settings, score, correct_count, total_count, wrong_items, played_at, quiz_sets(title)',
        )
        .order('played_at', { ascending: false })
      if (error) throw error

      return ((data ?? []) as unknown as RawPlayHistoryRow[]).map((row) => ({
        ...row,
        setTitle: row.quiz_sets?.title ?? null,
      }))
    },
  })
}
