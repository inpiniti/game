import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '../../entities/user'
import { ProfileSheet } from '../profile-sheet/ProfileSheet'
import styles from './Header.module.css'

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

const isLocalHost = () =>
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

// 자매 프로젝트(딸기노트 · 딸기주식) 이동 링크. 로컬 dev 서버는 상대 포트, 배포 후에는 Vercel 절대 URL로 이동.
const SIBLING_PROJECTS = [
  { label: '딸기노트', localUrl: 'http://localhost:5174', deployUrl: 'https://ddalki-note.vercel.app' },
  { label: '딸기주식', localUrl: 'http://localhost:5173', deployUrl: 'https://ddalki-stock.vercel.app' },
]

// 데스크톱/태블릿: 상단 헤더에 전체 네비게이션. 모바일: 로고+닉네임만(탭바가 나머지를 담당).
export function Header() {
  const { t } = useTranslation()
  const { profile } = useCurrentUser()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)

  return (
    <>
      <header className={styles.header}>
        <div className={styles.logoGroup}>
          <Link to="/" className={styles.logo}>
            {t('header.appName')}
          </Link>
          <button
            type="button"
            className={styles.projectSwitch}
            onClick={() => setProjectMenuOpen((open) => !open)}
            aria-label="Switch project"
            aria-expanded={projectMenuOpen}
          >
            ▾
          </button>

          {projectMenuOpen && (
            <div className={styles.projectMenu}>
              {SIBLING_PROJECTS.map((project) => (
                <a
                  key={project.label}
                  href={project.localUrl}
                  className={styles.projectMenuItem}
                  onClick={(e) => {
                    e.preventDefault()
                    window.location.href = isLocalHost() ? project.localUrl : project.deployUrl
                  }}
                >
                  {project.label}
                </a>
              ))}
              <div className={`${styles.projectMenuItem} ${styles.projectMenuItemActive}`}>
                딸기 서바이벌
              </div>
            </div>
          )}
        </div>

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
