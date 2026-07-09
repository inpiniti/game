import { useTranslation } from 'react-i18next'
import styles from './PlaceholderPage.module.css'

interface PlaceholderPageProps {
  title: string
}

// 아직 구현되지 않은 라우트(문제집/랭킹/기록/관리)의 깨진 링크 방지용 임시 화면.
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  const { t } = useTranslation()
  return (
    <div className={styles.wrap}>
      <p className={styles.emoji}>🚧</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.desc}>{t('placeholder.desc')}</p>
    </div>
  )
}
