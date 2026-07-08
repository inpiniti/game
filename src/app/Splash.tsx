import styles from './Splash.module.css'

// 세션 조회 중 깜빡임 방지용 스플래시 (RequireAuth/RequireAdmin/RequireGuest 공용).
export function Splash() {
  return (
    <div className={styles.wrap}>
      <p className={styles.logo}>🍓</p>
      <p className={styles.text}>불러오고 있어요…</p>
    </div>
  )
}
