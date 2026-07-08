import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import type { RankingBySetRow } from './types'

// 문제집별 랭킹(01-init.sql `ranking_by_set`) — 공식 문제집 기록만 집계됨은 RPC가 보장한다.
// country가 null이면 전체(글로벌), 코드를 넘기면 그 국가끼리만 비교한다.
export function useRankingBySet(setId: string | undefined, country: string | null) {
  return useQuery({
    queryKey: ['ranking', 'by-set', setId, country],
    enabled: !!setId,
    queryFn: async (): Promise<RankingBySetRow[]> => {
      const { data, error } = await supabase.rpc('ranking_by_set', {
        p_set_id: setId!,
        p_country: country,
        p_limit: 100,
      })
      if (error) throw error
      return (data ?? []) as unknown as RankingBySetRow[]
    },
  })
}
