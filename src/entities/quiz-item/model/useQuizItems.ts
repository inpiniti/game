import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import type { QuizItem } from './types'

export function useQuizItems(setId: string | undefined) {
  return useQuery({
    queryKey: ['quiz-items', setId],
    enabled: !!setId,
    queryFn: async (): Promise<QuizItem[]> => {
      const { data, error } = await supabase
        .from('quiz_items')
        .select('id, quiz_set_id, position, front, back, example')
        .eq('quiz_set_id', setId!)
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []) as QuizItem[]
    },
  })
}
