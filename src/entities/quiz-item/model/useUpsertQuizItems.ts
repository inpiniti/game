import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import type { QuizItem } from './types'

// id를 항상 채워서 넘긴다 — 신규 행은 호출부(features/upload-quiz-set, 문제집 수정 화면)가
// crypto.randomUUID()로 미리 생성해 넣으면, insert/update가 upsert 한 번으로 합쳐진다.
export interface UpsertQuizItemInput {
  id: string
  quiz_set_id: string
  position: number
  front: string
  back: string
  example: string | null
}

// 개인 문제집의 단어 추가·수정 — RLS "write items of own personal sets"가 본인 소유 문제집만 허용한다.
export function useUpsertQuizItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (items: UpsertQuizItemInput[]): Promise<QuizItem[]> => {
      if (items.length === 0) return []
      const { data, error } = await supabase
        .from('quiz_items')
        .upsert(items, { onConflict: 'id' })
        .select('id, quiz_set_id, position, front, back, example')
      if (error) throw error
      return (data ?? []) as QuizItem[]
    },
    onSuccess: (_data, items) => {
      const setId = items[0]?.quiz_set_id
      if (setId) queryClient.invalidateQueries({ queryKey: ['quiz-items', setId] })
    },
  })
}
