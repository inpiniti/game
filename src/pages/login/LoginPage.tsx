import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthCard } from '../../shared/ui/auth-card/AuthCard'
import { EmailNotConfirmedError, useLogin } from '../../features/auth/model/useLogin'
import { authErrorMessage } from '../../features/auth/lib/authErrorMessage'
import form from '../../shared/ui/form.module.css'
import styles from './LoginPage.module.css'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const { t } = useTranslation()
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
        <h1 className={styles.logo}>{t('common.gameTitle')}</h1>
        <p className={styles.tagline}>{t('login.tagline')}</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={form.field}>
          <span className={form.label}>{t('common.email')}</span>
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
          <span className={form.label}>{t('common.password')}</span>
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
          {login.isPending ? t('login.submitting') : t('login.submit')}
        </button>
      </form>

      <p className={styles.footer}>
        {t('login.noAccount')}{' '}
        <Link to="/signup" className={form.linkButton}>
          {t('login.signupLink')}
        </Link>
      </p>
    </AuthCard>
  )
}
