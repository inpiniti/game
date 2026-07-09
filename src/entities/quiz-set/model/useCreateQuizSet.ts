import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import type { CategoryCode } from '../../../shared/config/categories'
import { quizSetsQueryKey } from './useQuizSets'
import { adminQuizSetsQueryKey } from './useAdminQuizSets'

export interface CreateQuizSetInput {
  title: string
  learnLang: string | null
  userId: string
  /** 관리자 공식 업로드(features/upload-quiz-set의 official 모드)에서만 true + country를 함께 넘긴다. */
  isOfficial?: boolean
  country?: string | null
  category?: CategoryCode | null
}

// 개인 문제집 생성 시 기본값은 is_official=false·country=null 고정(RLS "write own personal sets"가
// 정확히 이 값 조합만 허용). 관리자 공식 업로드는 isOfficial:true + country를 명시적으로 넘기고,
// RLS "admin manages sets"(is_admin())가 이 조합의 insert를 별도로 허용한다.
export function useCreateQuizSet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateQuizSetInput): Promise<string> => {
      const { data, error } = await supabase
        .from('quiz_sets')
        .insert({
          title: input.title,
          user_id: input.userId,
          is_official: input.isOfficial ?? false,
          country: input.country ?? null,
          learn_lang: input.learnLang,
          category: input.category ?? null,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizSetsQueryKey })
      queryClient.invalidateQueries({ queryKey: adminQuizSetsQueryKey })
    },
  })
}
