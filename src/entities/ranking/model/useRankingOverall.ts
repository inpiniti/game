import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import type { RankingOverallRow } from './types'

// 전체 랭킹(01-init.sql `ranking_overall`) — 유저별 문제집 최고점의 평균 + 참여 문제집 수.
// country가 null이면 전체(글로벌), 코드를 넘기면 그 국가끼리만 비교한다.
export function useRankingOverall(country: string | null) {
  return useQuery({
    queryKey: ['ranking', 'overall', country],
    queryFn: async (): Promise<RankingOverallRow[]> => {
      const { data, error } = await supabase.rpc('ranking_overall', {
        p_country: country,
        p_limit: 100,
      })
      if (error) throw error
      return (data ?? []) as unknown as RankingOverallRow[]
    },
  })
}
