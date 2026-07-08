import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'

// 문제집 카드(widgets/quiz-set-grid)용 요약 — "학습 n/N"의 n(노출된 적 있는 단어 수)만 필요하므로
// head:true count 쿼리 하나로 끝낸다. N(전체 문항 수)은 이미 useQuizSets의 itemCount가 갖고 있다.
export function useSetLearnCount(setId: string | undefined) {
  return useQuery({
    queryKey: ['srs-progress', 'learn-count', setId],
    enabled: !!setId,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('srs_progress')
        .select('quiz_item_id, quiz_items!inner(quiz_set_id)', { count: 'exact', head: true })
        .eq('quiz_items.quiz_set_id', setId!)
      if (error) throw error
      return count ?? 0
    },
  })
}
