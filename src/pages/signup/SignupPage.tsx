import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthCard } from '../../shared/ui/auth-card/AuthCard'
import { CountrySelect } from '../../shared/ui/country-select/CountrySelect'
import { DEFAULT_COUNTRY_CODE } from '../../shared/config/countries'
import { AlreadyRegisteredError, useSignUp } from '../../features/auth/model/useSignUp'
import { authErrorMessage } from '../../features/auth/lib/authErrorMessage'
import form from '../../shared/ui/form.module.css'
import styles from './SignupPage.module.css'

const MIN_PASSWORD_LENGTH = 6

export function SignupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const signUp = useSignUp()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!nickname.trim()) {
      setErrorMessage(t('signup.errorNicknameRequired'))
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(t('signup.errorPasswordTooShort', { minLength: MIN_PASSWORD_LENGTH }))
      return
    }
    if (password !== passwordConfirm) {
      setErrorMessage(t('signup.errorPasswordMismatch'))
      return
    }

    try {
      await signUp.mutateAsync({ email, password, nickname: nickname.trim(), country })
      navigate('/verify-email', { state: { email }, replace: true })
    } catch (error) {
      if (error instanceof AlreadyRegisteredError) {
        setErrorMessage(t('signup.errorAlreadyRegistered'))
        return
      }
      setErrorMessage(authErrorMessage(error))
    }
  }

  return (
    <AuthCard>
      <div className={styles.header}>
        <Link to="/login" className={styles.back} aria-label={t('common.goBack')}>
          ←
        </Link>
        <h1 className={styles.title}>{t('signup.title')}</h1>
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
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className={form.input}
          />
        </label>

        <label className={form.field}>
          <span className={form.label}>{t('signup.passwordConfirmLabel')}</span>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            required
            autoComplete="new-password"
            className={form.input}
          />
        </label>

        <label className={form.field}>
          <span className={form.label}>{t('common.nickname')}</span>
          <input
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            required
            maxLength={20}
            autoComplete="nickname"
            className={form.input}
          />
        </label>

        <div className={form.field}>
          <span className={form.label}>{t('common.country')}</span>
          <CountrySelect value={country} onChange={setCountry} />
        </div>

        {errorMessage && <p className={form.error}>{errorMessage}</p>}

        <button
          type="submit"
          className={form.primaryButton}
          disabled={signUp.isPending}
          aria-busy={signUp.isPending}
        >
          {signUp.isPending ? t('signup.submitting') : t('signup.submit')}
        </button>
      </form>
    </AuthCard>
  )
}
