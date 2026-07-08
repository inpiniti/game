import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
        <h1 className={styles.title}>메일함을 확인해 주세요</h1>

        {initialEmail ? (
          <p className={styles.desc}>
            <strong>{initialEmail}</strong> 으로 인증 메일을 보냈어요.
            <br />
            메일의 링크를 누르면 가입이 완료돼요.
          </p>
        ) : (
          <p className={styles.desc}>가입할 때 사용한 이메일을 입력하면 인증 메일을 다시 보내드려요.</p>
        )}
      </div>

      <div className={styles.form}>
        {!initialEmail && (
          <label className={form.field}>
            <span className={form.label}>이메일</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={form.input}
            />
          </label>
        )}

        {sent && <p className={form.success}>메일을 다시 보냈어요. 메일함을 확인해 주세요.</p>}
        {errorMessage && <p className={form.error}>{errorMessage}</p>}

        <button
          type="button"
          className={form.primaryButton}
          onClick={handleResend}
          disabled={!email || resend.isPending || cooldown.isActive}
          aria-busy={resend.isPending}
        >
          {cooldown.isActive
            ? `메일 다시 보내기 (${cooldown.remaining}초)`
            : resend.isPending
              ? '보내고 있어요…'
              : '메일 다시 보내기'}
        </button>

        <Link to="/login" className={styles.backLink}>
          ← 로그인으로 돌아가기
        </Link>
      </div>
    </AuthCard>
  )
}
