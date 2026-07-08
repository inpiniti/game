import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'

export interface DeleteQuizItemInput {
  id: string
  quizSetId: string
}

// 문제집 수정 화면에서 단어 한 행 삭제 — RLS가 본인 소유 개인 문제집만 허용한다.
export function useDeleteQuizItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeleteQuizItemInput): Promise<void> => {
      const { error } = await supabase.from('quiz_items').delete().eq('id', input.id)
      if (error) throw error
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-items', input.quizSetId] })
    },
  })
}
