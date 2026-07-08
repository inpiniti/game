import { useEffect, useMemo, useState } from 'react'
import type { Profile } from '../../entities/user'
import { useQuizSets } from '../../entities/quiz-set'
import { useRankingBySet } from '../../entities/ranking'
import { learnLangLabel } from '../../shared/config/languages'
import { MyRankBar } from './MyRankBar'
import styles from './RankingPage.module.css'

interface RankingBySetTabProps {
  country: string | null
  profile: Profile | null
}

// 문제집별 탭 — 공식 문제집 선택 드롭다운 + 유저별 최고 점수 순위표(01-init.sql ranking_by_set).
export function RankingBySetTab({ country, profile }: RankingBySetTabProps) {
  const { data: sets, isLoading: setsLoading } = useQuizSets()
  const [setId, setSetId] = useState<string | undefined>(undefined)

  const officialSets = useMemo(
    () =>
      (sets ?? [])
        .filter((s) => s.is_official)
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title, 'ko')),
    [sets],
  )

  // 목록이 로드되면 첫 공식 문제집을 기본 선택으로 잡는다. 선택된 문제집이 사라지면(필터 변경 등) 다시 첫 항목으로.
  useEffect(() => {
    if (officialSets.length === 0) {
      setSetId(undefined)
      return
    }
    if (!setId || !officialSets.some((s) => s.id === setId)) {
      setSetId(officialSets[0].id)
    }
  }, [officialSets, setId])

  const { data: rows, isLoading: rankingLoading, isError } = useRankingBySet(setId, country)
  const isLoading = setsLoading || (!!setId && rankingLoading)

  const myRow = useMemo(() => {
    if (!profile || !rows) return null
    return rows.find((r) => r.nickname === profile.nickname && r.country === profile.country) ?? null
  }, [rows, profile])

  if (!setsLoading && officialSets.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyEmoji}>📭</p>
        <p className={styles.emptyTitle}>아직 공식 문제집이 없어요</p>
        <p className={styles.emptyDesc}>공식 문제집이 등록되면 여기서 순위를 볼 수 있어요</p>
      </div>
    )
  }

  return (
    <div className={styles.tabBody}>
      <select
        className={styles.select}
        value={setId ?? ''}
        onChange={(e) => setSetId(e.target.value)}
        aria-label="문제집 선택"
      >
        {officialSets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title} · {learnLangLabel(s.learn_lang)}
          </option>
        ))}
      </select>

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
          <p className={styles.emptyDesc}>이 문제집을 플레이하면 순위에 오를 수 있어요</p>
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
                <th>점수</th>
              </tr>
            </thead>
            <tbody>
              {rows!.map((r) => (
                <tr key={`${r.rank}-${r.nickname}`} className={r === myRow ? styles.me : undefined}>
                  <td className={styles.rankCell}>{r.rank}</td>
                  <td>{r.nickname}</td>
                  <td className={styles.countryBadge}>{r.country}</td>
                  <td>{r.best_score.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className={styles.cardList}>
            {rows!.map((r) => (
              <li key={`${r.rank}-${r.nickname}`} className={r === myRow ? `${styles.card} ${styles.cardMe}` : styles.card}>
                <div className={styles.cardLeft}>
                  <span className={styles.cardRank}>{r.rank}</span>
                  <span className={styles.cardName}>{r.nickname}</span>
                  <span className={styles.cardCountry}>{r.country}</span>
                </div>
                <div className={styles.cardRight}>
                  <div className={styles.cardScore}>{r.best_score.toLocaleString()}점</div>
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
        render={(row) => `${row.rank}위 · ${row.best_score.toLocaleString()}점`}
      />
    </div>
  )
}
