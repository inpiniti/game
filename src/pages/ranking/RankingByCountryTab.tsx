import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation()
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
        <p className={styles.errorNotice}>{t('ranking.loadError')}</p>
      )}

      {!isLoading && !isError && (rows?.length ?? 0) === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyEmoji}>📭</p>
          <p className={styles.emptyTitle}>{t('common.noRecordsTitle')}</p>
          <p className={styles.emptyDesc}>{t('ranking.byCountryEmptyDesc')}</p>
        </div>
      )}

      {!isLoading && !isError && (rows?.length ?? 0) > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('ranking.headerRank')}</th>
                <th>{t('common.country')}</th>
                <th>{t('ranking.headerAvgScore')}</th>
                <th>{t('ranking.headerParticipants')}</th>
              </tr>
            </thead>
            <tbody>
              {rows!.map((r) => (
                <tr key={r.country} className={r === myRow ? styles.me : undefined}>
                  <td className={styles.rankCell}>{r.rank}</td>
                  <td className={styles.countryBadge}>{r.country}</td>
                  <td>{r.avg_score.toLocaleString(i18n.language)}</td>
                  <td>{t('ranking.playersCount', { count: r.players })}</td>
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
                  <div className={styles.cardScore}>{t('common.scoreValue', { value: r.avg_score.toLocaleString(i18n.language) })}</div>
                  <div className={styles.cardSub}>{t('ranking.playersJoined', { count: r.players })}</div>
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
        render={(row) =>
          t('ranking.myRankByCountry', {
            country: row.country,
            rank: row.rank,
            score: row.avg_score.toLocaleString(i18n.language),
          })
        }
      />
    </div>
  )
}
