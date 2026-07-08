import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import type { SrsProgress } from './types'

interface RawSrsProgressRow extends SrsProgress {
  quiz_items: { quiz_set_id: string } | { quiz_set_id: string }[]
}

// 문제집 상세(pages/quiz-set-detail)용 — 그 문제집 항목들의 내 srs_progress 행 전부를 가져온다.
// quiz_items!inner로 조인해 quiz_set_id로 바로 필터링(RLS "own srs_progress"가 본인 행만 보장).
// 반환값을 entities/srs-progress의 deriveLearnStatus에 넘기면 미학습/학습 중/n일 뒤 복습을 판정할 수 있다.
export function useSrsProgressBySet(setId: string | undefined) {
  return useQuery({
    queryKey: ['srs-progress', 'set', setId],
    enabled: !!setId,
    queryFn: async (): Promise<SrsProgress[]> => {
      const { data, error } = await supabase
        .from('srs_progress')
        .select(
          'user_id, quiz_item_id, ease_factor, interval_days, repetition, lapses, due_at, last_reviewed_at, quiz_items!inner(quiz_set_id)',
        )
        .eq('quiz_items.quiz_set_id', setId!)
      if (error) throw error

      return ((data ?? []) as unknown as RawSrsProgressRow[]).map(
        ({ quiz_items: _quizItems, ...progress }) => progress,
      )
    },
  })
}
