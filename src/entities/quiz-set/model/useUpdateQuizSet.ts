import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import type { CategoryCode } from '../../../shared/config/categories'
import { quizSetsQueryKey } from './useQuizSets'
import { adminQuizSetsQueryKey } from './useAdminQuizSets'

// 관리자 전용 수정 — 공식 문제집의 제목/국가/언어 편집과 개인→공식 승격(is_official + country + learn_lang
// 지정)에 함께 쓴다. country: null이면 "공통(전체 국가)"(docs/sql/01-init.sql 스키마 주석).
// RLS "admin manages sets"(for all using is_admin() with check is_admin())가 소유자·is_official 값에
// 관계없이 관리자에게 모든 quiz_sets 행의 update를 허용한다 — "write own personal sets" 정책과 별개의
// permissive 정책이라 승격(is_official: false→true) 같은 조합도 admin 세션이면 통과한다.
export interface UpdateQuizSetInput {
  id: string
  title?: string
  country?: string | null
  learnLang?: string | null
  isOfficial?: boolean
  category?: CategoryCode | null
}

export function useUpdateQuizSet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateQuizSetInput): Promise<void> => {
      const patch: Record<string, unknown> = {}
      if (input.title !== undefined) patch.title = input.title
      if (input.country !== undefined) patch.country = input.country
      if (input.learnLang !== undefined) patch.learn_lang = input.learnLang
      if (input.isOfficial !== undefined) patch.is_official = input.isOfficial
      if (input.category !== undefined) patch.category = input.category

      const { error } = await supabase.from('quiz_sets').update(patch).eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizSetsQueryKey })
      queryClient.invalidateQueries({ queryKey: adminQuizSetsQueryKey })
    },
  })
}
