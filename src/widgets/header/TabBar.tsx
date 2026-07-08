import { NavLink } from 'react-router-dom'
import styles from './TabBar.module.css'

const TABS = [
  { to: '/', label: '홈', icon: '🏠', end: true },
  { to: '/sets', label: '문제집', icon: '📚', end: false },
  { to: '/ranking', label: '랭킹', icon: '🏆', end: false },
  { to: '/history', label: '기록', icon: '🕹', end: false },
]

// 모바일 전용 하단 탭바 (768px 이상은 CSS로 숨김). 게임 플레이 화면(/play/:setId)에서는 렌더되지 않는다.
export function TabBar() {
  return (
    <nav className={styles.tabbar} aria-label="하단 메뉴">
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
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
