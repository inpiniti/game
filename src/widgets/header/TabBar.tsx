import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './TabBar.module.css'

const TABS = [
  { to: '/', labelKey: 'tabbar.home', icon: '🏠', end: true },
  { to: '/sets', labelKey: 'tabbar.sets', icon: '📚', end: false },
  { to: '/ranking', labelKey: 'tabbar.ranking', icon: '🏆', end: false },
  { to: '/history', labelKey: 'tabbar.history', icon: '🕹', end: false },
] as const

// 모바일 전용 하단 탭바 (768px 이상은 CSS로 숨김). 게임 플레이 화면(/play/:setId)에서는 렌더되지 않는다.
export function TabBar() {
  const { t } = useTranslation()
  return (
    <nav className={styles.tabbar} aria-label={t('tabbar.nav')}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => (isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab)}
        >
          <span className={styles.icon} aria-hidden>
            {tab.icon}
          </span>
          <span>{t(tab.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
