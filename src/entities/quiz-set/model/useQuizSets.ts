import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import { useCurrentUser } from '../../user'
import type { QuizSetWithCount } from './types'

export const quizSetsQueryKey = ['quiz-sets'] as const

interface RawQuizSetRow {
  id: string
  title: string
  user_id: string | null
  is_official: boolean
  country: string | null
  learn_lang: string | null
  created_at: string
  quiz_items: { count: number }[]
}

// 현재 유저가 볼 수 있는 문제집(공식 + 본인 것)을 가져온다. RLS(read visible sets)는
// is_official 또는 본인 것까지만 걸러주고 국가 조건은 없으므로(설계 §3 "자기 국가 + 공통"),
// 공식 문제집은 여기서 country == null(공통) 또는 내 국가인 것만 남긴다. 개인 문제집은 항상 표시.
// quiz_items(count)로 문항 수까지 한 번에 집계한다. 언어 탭·구분 탭 필터링은 페이지에서 한다.
export function useQuizSets() {
  const { profile } = useCurrentUser()
  const myCountry = profile?.country ?? null

  return useQuery({
    queryKey: [...quizSetsQueryKey, myCountry],
    queryFn: async (): Promise<QuizSetWithCount[]> => {
      const { data, error } = await supabase
        .from('quiz_sets')
        .select('id, title, user_id, is_official, country, learn_lang, created_at, quiz_items(count)')
        .order('is_official', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error

      return ((data ?? []) as unknown as RawQuizSetRow[])
        .map((row) => ({
          id: row.id,
          title: row.title,
          user_id: row.user_id,
          is_official: row.is_official,
          country: row.country,
          learn_lang: row.learn_lang,
          created_at: row.created_at,
          itemCount: row.quiz_items?.[0]?.count ?? 0,
        }))
        // 공식: 공통(country null) 또는 내 국가만. 개인: 그대로.
        .filter((s) => !s.is_official || s.country == null || s.country === myCountry)
    },
  })
}
