import { AuthError } from '@supabase/supabase-js'
import { i18n } from '../../../shared/i18n'

// Supabase auth 에러를 해요체·긍정형 안내 문구로 변환한다.
// error.code(구조화된 코드)를 우선 쓰고, 그 외 에러는 일반 안내로 감싼다.
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'user_already_exists':
      case 'email_exists':
        return i18n.t('auth.emailAlreadyRegistered')
      case 'weak_password':
        return i18n.t('auth.weakPassword')
      case 'invalid_credentials':
        return i18n.t('auth.invalidCredentials')
      case 'email_address_invalid':
        return i18n.t('auth.invalidEmail')
      case 'over_email_send_rate_limit':
        return i18n.t('auth.emailRateLimit')
      case 'over_request_rate_limit':
        return i18n.t('auth.requestRateLimit')
      case 'signup_disabled':
        return i18n.t('auth.signupDisabled')
      default:
        return i18n.t('auth.genericError')
    }
  }
  return i18n.t('auth.genericError')
}
