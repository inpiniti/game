import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '../../entities/user'
import { ProfileSheet } from '../profile-sheet/ProfileSheet'
import styles from './Header.module.css'

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

// 데스크톱/태블릿: 상단 헤더에 전체 네비게이션. 모바일: 로고+닉네임만(탭바가 나머지를 담당).
export function Header() {
  const { t } = useTranslation()
  const { profile } = useCurrentUser()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          🍓 {t('header.appName')}
        </Link>

        <nav className={styles.nav} aria-label={t('header.mainNav')}>
          <NavLink to="/sets" className={navLinkClassName}>
            {t('header.sets')}
          </NavLink>
          <NavLink to="/ranking" className={navLinkClassName}>
            {t('header.ranking')}
          </NavLink>
          <NavLink to="/history" className={navLinkClassName}>
            {t('header.history')}
          </NavLink>
          {profile?.role === 'admin' && (
            <NavLink to="/admin/sets" className={navLinkClassName}>
              {t('header.admin')}
            </NavLink>
          )}
        </nav>

        <button type="button" className={styles.profileButton} onClick={() => setSheetOpen(true)}>
          {profile && <span className={styles.country}>{profile.country}</span>}
          <span className={styles.nickname}>{profile?.nickname ?? '...'}</span>
          <span aria-hidden>▾</span>
        </button>
      </header>

      <ProfileSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
