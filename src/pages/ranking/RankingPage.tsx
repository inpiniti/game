import { useState } from 'react'
import { useCurrentUser } from '../../entities/user'
import { RankingBySetTab } from './RankingBySetTab'
import { RankingOverallTab } from './RankingOverallTab'
import { RankingByCountryTab } from './RankingByCountryTab'
import styles from './RankingPage.module.css'

type Tab = 'by-set' | 'overall' | 'by-country'
type Scope = 'mine' | 'all'

const TABS: { key: Tab; label: string }[] = [
  { key: 'by-set', label: '문제집별' },
  { key: 'overall', label: '전체' },
  { key: 'by-country', label: '국가 대항' },
]

// 랭킹 `/ranking` (screens-v3 §11, 설계 §9) — 탭 3종 + 범위 토글(기본 = 내 국가).
// 국가 대항 탭은 범위 토글 없음(전 국가 비교) — RPC ranking_by_country가 국가 필터를 받지 않는다.
export function RankingPage() {
  const { profile } = useCurrentUser()
  const myCountry = profile?.country ?? null

  const [tab, setTab] = useState<Tab>('by-set')
  const [scope, setScope] = useState<Scope>('mine')

  const country = scope === 'mine' ? myCountry : null

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>랭킹</h1>

      <div className={styles.tabs} role="tablist" aria-label="랭킹 종류">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'by-country' && (
        <div className={styles.scopeToggle}>
          <span className={styles.scopeLabel}>범위</span>
          <button
            type="button"
            className={scope === 'mine' ? `${styles.scopeButton} ${styles.scopeButtonActive}` : styles.scopeButton}
            onClick={() => setScope('mine')}
          >
            내 국가{myCountry ? ` (${myCountry})` : ''}
          </button>
          <button
            type="button"
            className={scope === 'all' ? `${styles.scopeButton} ${styles.scopeButtonActive}` : styles.scopeButton}
            onClick={() => setScope('all')}
          >
            전체
          </button>
        </div>
      )}

      {tab === 'by-set' && <RankingBySetTab country={country} profile={profile} />}
      {tab === 'overall' && <RankingOverallTab country={country} profile={profile} />}
      {tab === 'by-country' && <RankingByCountryTab profile={profile} />}
    </div>
  )
}
