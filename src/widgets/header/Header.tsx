import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCurrentUser } from '../../entities/user'
import { ProfileSheet } from '../profile-sheet/ProfileSheet'
import styles from './Header.module.css'

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

// 데스크톱/태블릿: 상단 헤더에 전체 네비게이션. 모바일: 로고+닉네임만(탭바가 나머지를 담당).
export function Header() {
  const { profile } = useCurrentUser()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          🍓 딸기 서바이벌
        </Link>

        <nav className={styles.nav} aria-label="주 메뉴">
          <NavLink to="/sets" className={navLinkClassName}>
            문제집
          </NavLink>
          <NavLink to="/ranking" className={navLinkClassName}>
            랭킹
          </NavLink>
          <NavLink to="/history" className={navLinkClassName}>
            기록
          </NavLink>
          {profile?.role === 'admin' && (
            <NavLink to="/admin/sets" className={navLinkClassName}>
              관리
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
