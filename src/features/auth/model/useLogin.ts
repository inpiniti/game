import { useMutation } from '@tanstack/react-query'
import { AuthError } from '@supabase/supabase-js'
import { supabase } from '../../../shared/api/supabase'

export interface LoginInput {
  email: string
  password: string
}

// 미인증 계정으로 로그인 시도 시 던진다 — 호출부(LoginPage)가 /verify-email로 유도한다.
export class EmailNotConfirmedError extends Error {
  email: string
  constructor(email: string) {
    super('email_not_confirmed')
    this.name = 'EmailNotConfirmedError'
    this.email = email
  }
}

export function useLogin() {
  return useMutation({
    mutationFn: async ({ email, password }: LoginInput) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error instanceof AuthError && error.code === 'email_not_confirmed') {
          throw new EmailNotConfirmedError(email)
        }
        throw error
      }
      return data
    },
  })
}
