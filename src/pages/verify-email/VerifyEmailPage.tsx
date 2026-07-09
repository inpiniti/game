import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthCard } from '../../shared/ui/auth-card/AuthCard'
import { useResendVerification } from '../../features/auth/model/useResendVerification'
import { authErrorMessage } from '../../features/auth/lib/authErrorMessage'
import { useCountdown } from '../../shared/lib/useCountdown'
import form from '../../shared/ui/form.module.css'
import styles from './VerifyEmailPage.module.css'

const RESEND_COOLDOWN_SECONDS = 60

interface LocationState {
  email?: string
}

// 회원가입 성공 직후, 또는 미인증 계정 로그인 시도 시 이 화면으로 온다.
// 새로고침으로 location.state가 사라진 경우엔 이메일을 직접 입력받아 재전송할 수 있게 한다.
export function VerifyEmailPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const initialEmail = (location.state as LocationState | null)?.email ?? ''
  const [email, setEmail] = useState(initialEmail)
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const resend = useResendVerification()
  const cooldown = useCountdown(RESEND_COOLDOWN_SECONDS)

  const handleResend = async () => {
    if (!email || cooldown.isActive) return
    setErrorMessage(null)
    setSent(false)
    try {
      await resend.mutateAsync({ email })
      setSent(true)
      cooldown.start()
    } catch (error) {
      setErrorMessage(authErrorMessage(error))
    }
  }

  return (
    <AuthCard>
      <div className={styles.body}>
        <p className={styles.emoji}>📮</p>
        <h1 className={styles.title}>{t('verifyEmail.title')}</h1>

        {initialEmail ? (
          <p className={styles.desc}>
            <strong>{initialEmail}</strong> {t('verifyEmail.sentDescSuffix')}
            <br />
            {t('verifyEmail.sentDescLine2')}
          </p>
        ) : (
          <p className={styles.desc}>{t('verifyEmail.descNoEmail')}</p>
        )}
      </div>

      <div className={styles.form}>
        {!initialEmail && (
          <label className={form.field}>
            <span className={form.label}>{t('common.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={form.input}
            />
          </label>
        )}

        {sent && <p className={form.success}>{t('verifyEmail.resentNotice')}</p>}
        {errorMessage && <p className={form.error}>{errorMessage}</p>}

        <button
          type="button"
          className={form.primaryButton}
          onClick={handleResend}
          disabled={!email || resend.isPending || cooldown.isActive}
          aria-busy={resend.isPending}
        >
          {cooldown.isActive
            ? t('verifyEmail.resendCountdown', { seconds: cooldown.remaining })
            : resend.isPending
              ? t('verifyEmail.sending')
              : t('verifyEmail.resend')}
        </button>

        <Link to="/login" className={styles.backLink}>
          {t('verifyEmail.backToLogin')}
        </Link>
      </div>
    </AuthCard>
  )
}
