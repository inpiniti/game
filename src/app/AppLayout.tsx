import { Outlet } from 'react-router-dom'
import { Header } from '../widgets/header/Header'
import { TabBar } from '../widgets/header/TabBar'
import styles from './AppLayout.module.css'

// 인증된 라우트 레이아웃 — 데스크톱/태블릿은 상단 헤더, 모바일은 상단 간소 헤더 + 하단 탭바.
// /play/:setId는 이 레이아웃 바깥(전체화면)에서 렌더된다.
export function AppLayout() {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
