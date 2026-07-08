import type { ReactNode } from 'react'
import styles from './AuthCard.module.css'

// 로그인/가입/이메일 확인 화면 공통 레이아웃 — 헤더·탭바 없이 가운데 정렬된 카드 하나.
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>{children}</div>
    </div>
  )
}
