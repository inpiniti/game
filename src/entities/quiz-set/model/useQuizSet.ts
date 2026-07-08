import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import type { QuizSet } from './types'

export function useQuizSet(setId: string | undefined) {
  return useQuery({
    queryKey: ['quiz-set', setId],
    enabled: !!setId,
    queryFn: async (): Promise<QuizSet | null> => {
      const { data, error } = await supabase
        .from('quiz_sets')
        .select('id, title, user_id, is_official, country, learn_lang, created_at')
        .eq('id', setId!)
        .maybeSingle()
      if (error) throw error
      return (data as QuizSet | null) ?? null
    },
  })
}
