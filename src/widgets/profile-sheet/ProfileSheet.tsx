import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../shared/ui/bottom-sheet/BottomSheet'
import { CountrySelect } from '../../shared/ui/country-select/CountrySelect'
import { DEFAULT_COUNTRY_CODE } from '../../shared/config/countries'
import { useCurrentUser, useUpdateProfile } from '../../entities/user'
import { useLogout } from '../../features/auth/model/useLogout'
import { SUPPORTED_LANGS, LANG_LABELS, changeUiLang, saveStoredLang, isUiLang } from '../../shared/i18n'
import styles from './ProfileSheet.module.css'

interface ProfileSheetProps {
  open: boolean
  onClose: () => void
}

// 헤더 닉네임 탭 → 프로필 바텀시트. 닉네임 인라인 변경 · 국가 변경 · 이메일 읽기전용 · 로그아웃.
export function ProfileSheet({ open, onClose }: ProfileSheetProps) {
  const { t, i18n } = useTranslation()
  const { session, profile } = useCurrentUser()
  const updateProfile = useUpdateProfile()
  const logout = useLogout()
  const navigate = useNavigate()

  const [editingNickname, setEditingNickname] = useState(false)
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setNickname(profile?.nickname ?? '')
  }, [profile?.nickname])

  const handleNicknameSave = async () => {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed === profile?.nickname) {
      setEditingNickname(false)
      return
    }
    setErrorMessage(null)
    try {
      await updateProfile.mutateAsync({ nickname: trimmed })
      setEditingNickname(false)
    } catch {
      setErrorMessage(t('profileSheet.nicknameSaveError'))
    }
  }

  const handleCountryChange = async (code: string) => {
    setErrorMessage(null)
    try {
      await updateProfile.mutateAsync({ country: code })
    } catch {
      setErrorMessage(t('profileSheet.countrySaveError'))
    }
  }

  const handleLanguageChange = (value: string) => {
    if (!isUiLang(value)) return
    saveStoredLang(value) // 명시 선택 저장 — 다음 접속 시에도 유지, 국가 매핑보다 우선
    void changeUiLang(value) // 로케일 청크 로드 + 즉시 전 화면 반영 + RTL dir 전환
  }

  const handleLogout = async () => {
    await logout.mutateAsync()
    onClose()
    navigate('/login', { replace: true })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('profileSheet.title')}>
      <div className={styles.row}>
        <span className={styles.rowLabel}>{t('profileSheet.nicknameLabel')}</span>
        {editingNickname ? (
          <div className={styles.editGroup}>
            <input
              className={styles.input}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={20}
              autoFocus
            />
            <button
              type="button"
              className={styles.smallButton}
              onClick={handleNicknameSave}
              disabled={updateProfile.isPending}
            >
              {t('profileSheet.change')}
            </button>
          </div>
        ) : (
          <button type="button" className={styles.valueButton} onClick={() => setEditingNickname(true)}>
            {profile?.nickname}
            <span aria-hidden>✎ {t('profileSheet.change')}</span>
          </button>
        )}
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>{t('profileSheet.language')}</span>
        <select
          className={styles.languageSelect}
          value={i18n.resolvedLanguage ?? i18n.language}
          onChange={(event) => handleLanguageChange(event.target.value)}
        >
          {SUPPORTED_LANGS.map((lang) => (
            <option key={lang} value={lang}>
              {LANG_LABELS[lang]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>{t('profileSheet.countryLabel')}</span>
        <CountrySelect value={profile?.country ?? DEFAULT_COUNTRY_CODE} onChange={handleCountryChange} />
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>{t('profileSheet.emailLabel')}</span>
        <span className={styles.readonlyValue}>{session?.user.email}</span>
      </div>

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      <button
        type="button"
        className={styles.logoutButton}
        onClick={handleLogout}
        disabled={logout.isPending}
        aria-busy={logout.isPending}
      >
        {logout.isPending ? t('profileSheet.loggingOut') : t('profileSheet.logout')}
      </button>
    </BottomSheet>
  )
}
