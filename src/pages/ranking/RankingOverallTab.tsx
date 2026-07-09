import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation()
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
        <p className={styles.errorNotice}>{t('ranking.loadError')}</p>
      )}

      {!isLoading && !isError && (rows?.length ?? 0) === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyEmoji}>📭</p>
          <p className={styles.emptyTitle}>{t('common.noRecordsTitle')}</p>
          <p className={styles.emptyDesc}>{t('ranking.overallEmptyDesc')}</p>
        </div>
      )}

      {!isLoading && !isError && (rows?.length ?? 0) > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('ranking.headerRank')}</th>
                <th>{t('common.nickname')}</th>
                <th>{t('common.country')}</th>
                <th>{t('ranking.headerAvgScore')}</th>
                <th>{t('ranking.headerSetsPlayed')}</th>
              </tr>
            </thead>
            <tbody>
              {rows!.map((r) => (
                <tr key={`${r.rank}-${r.nickname}`} className={r === myRow ? styles.me : undefined}>
                  <td className={styles.rankCell}>{r.rank}</td>
                  <td>{r.nickname}</td>
                  <td className={styles.countryBadge}>{r.country}</td>
                  <td>{r.avg_score.toLocaleString(i18n.language)}</td>
                  <td>{t('ranking.setsPlayedCount', { count: r.sets_played })}</td>
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
                  <div className={styles.cardScore}>{t('common.scoreValue', { value: r.avg_score.toLocaleString(i18n.language) })}</div>
                  <div className={styles.cardSub}>{t('ranking.setsPlayedJoined', { count: r.sets_played })}</div>
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
        render={(row) => t('ranking.myRankGeneric', { rank: row.rank, score: row.avg_score.toLocaleString(i18n.language) })}
      />
    </div>
  )
}
