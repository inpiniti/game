import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import { authQueryKeys, useCurrentUser } from './useCurrentUser'

// RLS grant가 nickname/country 컬럼만 허용한다 (docs/sql/01-init.sql) — role은 여기서 변경 불가.
export interface UpdateProfileInput {
  nickname?: string
  country?: string
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const { session } = useCurrentUser()
  const userId = session?.user.id

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!userId) throw new Error('로그인이 필요해요.')
      const { error } = await supabase.from('profiles').update(input).eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: authQueryKeys.profile(userId) })
    },
  })
}
