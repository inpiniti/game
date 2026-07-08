import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import type { RankingByCountryRow } from './types'

// 국가 대항 랭킹(01-init.sql `ranking_by_country`) — 국가별 유저 평균점의 평균 + 참여 인원.
// 범위 토글이 없다 — 항상 전 국가 비교.
export function useRankingByCountry() {
  return useQuery({
    queryKey: ['ranking', 'by-country'],
    queryFn: async (): Promise<RankingByCountryRow[]> => {
      const { data, error } = await supabase.rpc('ranking_by_country', { p_limit: 50 })
      if (error) throw error
      return (data ?? []) as unknown as RankingByCountryRow[]
    },
  })
}
