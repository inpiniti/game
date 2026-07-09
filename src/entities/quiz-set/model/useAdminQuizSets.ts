import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import { useCurrentUser } from '../../user'
import type { CategoryCode } from '../../../shared/config/categories'
import type { QuizSetWithCount } from './types'

export const adminQuizSetsQueryKey = ['admin-quiz-sets'] as const

interface RawQuizSetRow {
  id: string
  title: string
  user_id: string | null
  is_official: boolean
  country: string | null
  learn_lang: string | null
  category: string | null
  created_at: string
  quiz_items: { count: number }[]
}

// 관리자 전용 — 국가 필터 없이 모든 문제집(공식 + 모든 유저의 개인 문제집)을 가져온다.
// RLS "admin manages sets"(for all using is_admin(), docs/sql/01-init.sql)가 관리자에게 전 행 SELECT를
// 허용하므로, 일반 유저용 useQuizSets(본인 국가·본인 것만 필터)와 달리 서버 응답을 추가로 거를 필요가 없다.
// 관리자가 아닌 상태에서 실수로 호출돼도 RLS가 어차피 막지만, enabled로 요청 자체를 보내지 않는다(이중 방어).
export function useAdminQuizSets() {
  const { isAdmin } = useCurrentUser()

  return useQuery({
    queryKey: adminQuizSetsQueryKey,
    enabled: isAdmin,
    queryFn: async (): Promise<QuizSetWithCount[]> => {
      const { data, error } = await supabase
        .from('quiz_sets')
        .select('id, title, user_id, is_official, country, learn_lang, category, created_at, quiz_items(count)')
        .order('is_official', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error

      return ((data ?? []) as unknown as RawQuizSetRow[]).map((row) => ({
        id: row.id,
        title: row.title,
        user_id: row.user_id,
        is_official: row.is_official,
        country: row.country,
        learn_lang: row.learn_lang,
        category: row.category as CategoryCode | null,
        created_at: row.created_at,
        itemCount: row.quiz_items?.[0]?.count ?? 0,
      }))
    },
  })
}
