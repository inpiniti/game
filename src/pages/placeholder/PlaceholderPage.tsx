import styles from './PlaceholderPage.module.css'

interface PlaceholderPageProps {
  title: string
}

// 아직 구현되지 않은 라우트(문제집/랭킹/기록/관리)의 깨진 링크 방지용 임시 화면.
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className={styles.wrap}>
      <p className={styles.emoji}>🚧</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.desc}>곧 만나볼 수 있어요. 준비하고 있어요.</p>
    </div>
  )
}
