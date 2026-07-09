import { useTranslation } from 'react-i18next'
import styles from './Splash.module.css'

// 세션 조회 중 깜빡임 방지용 스플래시 (RequireAuth/RequireAdmin/RequireGuest 공용).
export function Splash() {
  const { t } = useTranslation()
  return (
    <div className={styles.wrap}>
      <p className={styles.logo}>🍓</p>
      <p className={styles.text}>{t('common.loading')}</p>
    </div>
  )
}
