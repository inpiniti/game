import { useMemo } from 'react'
import type { Profile } from '../../entities/user'
import { useRankingByCountry } from '../../entities/ranking'
import { MyRankBar } from './MyRankBar'
import styles from './RankingPage.module.css'

interface RankingByCountryTabProps {
  profile: Profile | null
}

// 국가 대항 탭 — 국가별 "유저 평균점의 평균" + 참여 인원(01-init.sql ranking_by_country).
// 범위 토글 없음(항상 전 국가 비교). "내 순위"는 내 국가(profile.country)의 순위를 뜻한다.
export function RankingByCountryTab({ profile }: RankingByCountryTabProps) {
  const { data: rows, isLoading, isError } = useRankingByCountry()

  const myRow = useMemo(() => {
    if (!profile || !rows) return null
    return rows.find((r) => r.country === profile.country) ?? null
  }, [rows, profile])

  return (
    <div className={styles.tabBody}>
      {isLoading && (
        <div className={styles.skeletonList}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <p className={styles.errorNotice}>순위를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      )}

      {!isLoading && !isError && (rows?.length ?? 0) === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyEmoji}>📭</p>
          <p className={styles.emptyTitle}>아직 기록이 없어요</p>
          <p className={styles.emptyDesc}>공식 문제집을 플레이하면 국가 순위가 쌓여요</p>
        </div>
      )}

      {!isLoading && !isError && (rows?.length ?? 0) > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>순위</th>
                <th>국가</th>
                <th>평균점</th>
                <th>참여 인원</th>
              </tr>
            </thead>
            <tbody>
              {rows!.map((r) => (
                <tr key={r.country} className={r === myRow ? styles.me : undefined}>
                  <td className={styles.rankCell}>{r.rank}</td>
                  <td className={styles.countryBadge}>{r.country}</td>
                  <td>{r.avg_score.toLocaleString()}</td>
                  <td>{r.players}명</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className={styles.cardList}>
            {rows!.map((r) => (
              <li key={r.country} className={r === myRow ? `${styles.card} ${styles.cardMe}` : styles.card}>
                <div className={styles.cardLeft}>
                  <span className={styles.cardRank}>{r.rank}</span>
                  <span className={styles.cardCountry}>{r.country}</span>
                </div>
                <div className={styles.cardRight}>
                  <div className={styles.cardScore}>{r.avg_score.toLocaleString()}점</div>
                  <div className={styles.cardSub}>{r.players}명 참여</div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <MyRankBar
        loading={isLoading}
        hasError={isError}
        myRow={myRow}
        render={(row) => `내 국가 ${row.country} ${row.rank}위 · ${row.avg_score.toLocaleString()}점`}
      />
    </div>
  )
}
