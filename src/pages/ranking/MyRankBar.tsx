import styles from './RankingPage.module.css'

interface MyRankBarProps<T> {
  loading: boolean
  hasError: boolean
  myRow: T | null
  render: (row: T) => string
}

// 하단 고정 "내 순위" — 반환된 목록(상위 N)에서 nickname+country(국가 대항은 country만)로 찾는다.
// 목록 밖 순위는 계산하지 않으므로(가정), 못 찾으면 "아직 순위에 없어요"로 표기한다.
export function MyRankBar<T>({ loading, hasError, myRow, render }: MyRankBarProps<T>) {
  if (loading || hasError) return null

  return (
    <div className={styles.myRankBar}>
      <div className={styles.myRankInner}>
        <span className={styles.myRankLabel}>내 순위</span>
        {myRow ? (
          <span className={styles.myRankValue}>{render(myRow)}</span>
        ) : (
          <span className={styles.myRankEmpty}>아직 순위에 없어요</span>
        )}
      </div>
    </div>
  )
}
