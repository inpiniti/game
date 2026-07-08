import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'

export interface SignUpInput {
  email: string
  password: string
  nickname: string
  country: string
}

// 이메일 확인 ON 상태에서 이미 가입 확인된 이메일로 signUp 하면 에러 없이
// "가짜" user(식별자 노출 방지용, identities: [])를 돌려준다 — 이 경우를 별도로 잡아준다.
export class AlreadyRegisteredError extends Error {
  constructor() {
    super('already_registered')
    this.name = 'AlreadyRegisteredError'
  }
}

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ email, password, nickname, country }: SignUpInput) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname, country } },
      })
      if (error) throw error
      if (data.user && data.user.identities?.length === 0) {
        throw new AlreadyRegisteredError()
      }
      return data
    },
  })
}
