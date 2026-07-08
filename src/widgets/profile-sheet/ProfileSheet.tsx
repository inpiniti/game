import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomSheet } from '../../shared/ui/bottom-sheet/BottomSheet'
import { CountrySelect } from '../../shared/ui/country-select/CountrySelect'
import { DEFAULT_COUNTRY_CODE } from '../../shared/config/countries'
import { useCurrentUser, useUpdateProfile } from '../../entities/user'
import { useLogout } from '../../features/auth/model/useLogout'
import styles from './ProfileSheet.module.css'

interface ProfileSheetProps {
  open: boolean
  onClose: () => void
}

// 헤더 닉네임 탭 → 프로필 바텀시트. 닉네임 인라인 변경 · 국가 변경 · 이메일 읽기전용 · 로그아웃.
export function ProfileSheet({ open, onClose }: ProfileSheetProps) {
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
      setErrorMessage('닉네임을 저장하지 못했어요. 다시 시도해 주세요.')
    }
  }

  const handleCountryChange = async (code: string) => {
    setErrorMessage(null)
    try {
      await updateProfile.mutateAsync({ country: code })
    } catch {
      setErrorMessage('국가를 저장하지 못했어요. 다시 시도해 주세요.')
    }
  }

  const handleLogout = async () => {
    await logout.mutateAsync()
    onClose()
    navigate('/login', { replace: true })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="프로필">
      <div className={styles.row}>
        <span className={styles.rowLabel}>닉네임</span>
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
              변경
            </button>
          </div>
        ) : (
          <button type="button" className={styles.valueButton} onClick={() => setEditingNickname(true)}>
            {profile?.nickname}
            <span aria-hidden>✎ 변경</span>
          </button>
        )}
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>국가</span>
        <CountrySelect value={profile?.country ?? DEFAULT_COUNTRY_CODE} onChange={handleCountryChange} />
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>이메일</span>
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
        {logout.isPending ? '로그아웃하고 있어요…' : '로그아웃'}
      </button>
    </BottomSheet>
  )
}
