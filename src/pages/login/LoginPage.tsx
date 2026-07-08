import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthCard } from '../../shared/ui/auth-card/AuthCard'
import { EmailNotConfirmedError, useLogin } from '../../features/auth/model/useLogin'
import { authErrorMessage } from '../../features/auth/lib/authErrorMessage'
import form from '../../shared/ui/form.module.css'
import styles from './LoginPage.module.css'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const login = useLogin()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    try {
      await login.mutateAsync({ email, password })
      const state = location.state as LocationState | null
      navigate(state?.from ?? '/', { replace: true })
    } catch (error) {
      if (error instanceof EmailNotConfirmedError) {
        navigate('/verify-email', { state: { email: error.email }, replace: true })
        return
      }
      setErrorMessage(authErrorMessage(error))
    }
  }

  return (
    <AuthCard>
      <div className={styles.header}>
        <h1 className={styles.logo}>🍓 딸기 서바이벌</h1>
        <p className={styles.tagline}>단어를 잡는 서바이벌</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={form.field}>
          <span className={form.label}>이메일</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className={form.input}
          />
        </label>

        <label className={form.field}>
          <span className={form.label}>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            className={form.input}
          />
        </label>

        {errorMessage && <p className={form.error}>{errorMessage}</p>}

        <button
          type="submit"
          className={form.primaryButton}
          disabled={login.isPending}
          aria-busy={login.isPending}
        >
          {login.isPending ? '로그인하고 있어요…' : '로그인'}
        </button>
      </form>

      <p className={styles.footer}>
        계정이 없나요?{' '}
        <Link to="/signup" className={form.linkButton}>
          회원가입 →
        </Link>
      </p>
    </AuthCard>
  )
}
