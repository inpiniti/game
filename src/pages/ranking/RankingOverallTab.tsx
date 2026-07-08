import { useMemo } from 'react'
import type { Profile } from '../../entities/user'
import { useRankingOverall } from '../../entities/ranking'
import { MyRankBar } from './MyRankBar'
import styles from './RankingPage.module.css'

interface RankingOverallTabProps {
  country: string | null
  profile: Profile | null
}

// 전체 탭 — 유저별 (문제집별 최고점) 평균 + 참여 문제집 수(01-init.sql ranking_overall).
// "많이 깬 사람"이 아니라 "잘 깬 사람"이 이기도록 합산이 아닌 평균으로 집계된다(RPC가 보장).
export function RankingOverallTab({ country, profile }: RankingOverallTabProps) {
  const { data: rows, isLoading, isError } = useRankingOverall(country)

  const myRow = useMemo(() => {
    if (!profile || !rows) return null
    return rows.find((r) => r.nickname === profile.nickname && r.country === profile.country) ?? null
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
          <p className={styles.emptyDesc}>공식 문제집을 플레이하면 순위에 오를 수 있어요</p>
        </div>
      )}

      {!isLoading && !isError && (rows?.length ?? 0) > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>순위</th>
                <th>닉네임</th>
                <th>국가</th>
                <th>평균점</th>
                <th>참여 문제집</th>
              </tr>
            </thead>
            <tbody>
              {rows!.map((r) => (
                <tr key={`${r.rank}-${r.nickname}`} className={r === myRow ? styles.me : undefined}>
                  <td className={styles.rankCell}>{r.rank}</td>
                  <td>{r.nickname}</td>
                  <td className={styles.countryBadge}>{r.country}</td>
                  <td>{r.avg_score.toLocaleString()}</td>
                  <td>{r.sets_played}개</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className={styles.cardList}>
            {rows!.map((r) => (
              <li
                key={`${r.rank}-${r.nickname}`}
                className={r === myRow ? `${styles.card} ${styles.cardMe}` : styles.card}
              >
                <div className={styles.cardLeft}>
                  <span className={styles.cardRank}>{r.rank}</span>
                  <span className={styles.cardName}>{r.nickname}</span>
                  <span className={styles.cardCountry}>{r.country}</span>
                </div>
                <div className={styles.cardRight}>
                  <div className={styles.cardScore}>{r.avg_score.toLocaleString()}점</div>
                  <div className={styles.cardSub}>{r.sets_played}개 참여</div>
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
        render={(row) => `${row.rank}위 · ${row.avg_score.toLocaleString()}점`}
      />
    </div>
  )
}
