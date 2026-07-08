import { AuthError } from '@supabase/supabase-js'

// Supabase auth 에러를 해요체·긍정형 안내 문구로 변환한다.
// error.code(구조화된 코드)를 우선 쓰고, 그 외 에러는 일반 안내로 감싼다.
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'user_already_exists':
      case 'email_exists':
        return '이미 가입된 이메일이에요. 로그인해 주세요.'
      case 'weak_password':
        return '비밀번호가 너무 간단해요. 6자 이상, 다른 조합으로 입력해 주세요.'
      case 'invalid_credentials':
        return '이메일 또는 비밀번호가 달라요. 다시 확인해 주세요.'
      case 'email_address_invalid':
        return '이메일 형식을 다시 확인해 주세요.'
      case 'over_email_send_rate_limit':
        return '메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.'
      case 'over_request_rate_limit':
        return '요청이 많아요. 잠시 후 다시 시도해 주세요.'
      case 'signup_disabled':
        return '지금은 가입을 받지 않아요. 나중에 다시 시도해 주세요.'
      default:
        return '잠시 연결이 어려워요. 조금 뒤에 다시 시도해 주세요.'
    }
  }
  return '잠시 연결이 어려워요. 조금 뒤에 다시 시도해 주세요.'
}
