import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import { quizSetsQueryKey } from './useQuizSets'
import { adminQuizSetsQueryKey } from './useAdminQuizSets'

// 개인 문제집 삭제 — RLS "write own personal sets"가 본인 것만 허용한다.
// 관리자가 호출하면 "admin manages sets"(is_admin())가 별도로 전 행 삭제를 허용해 공식 문제집도 지울 수 있다
// (admin/sets 페이지의 [삭제]가 이 훅을 그대로 재사용). quiz_items는 FK on delete cascade라 함께 정리된다.
export function useDeleteQuizSet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (setId: string): Promise<void> => {
      const { error } = await supabase.from('quiz_sets').delete().eq('id', setId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizSetsQueryKey })
      queryClient.invalidateQueries({ queryKey: adminQuizSetsQueryKey })
    },
  })
}
