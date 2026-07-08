import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'

export interface ResendVerificationInput {
  email: string
}

export function useResendVerification() {
  return useMutation({
    mutationFn: async ({ email }: ResendVerificationInput) => {
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) throw error
    },
  })
}
