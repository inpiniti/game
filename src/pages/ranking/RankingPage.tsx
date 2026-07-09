import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '../../entities/user'
import { RankingBySetTab } from './RankingBySetTab'
import { RankingOverallTab } from './RankingOverallTab'
import { RankingByCountryTab } from './RankingByCountryTab'
import styles from './RankingPage.module.css'

type Tab = 'by-set' | 'overall' | 'by-country'
type Scope = 'mine' | 'all'

// 랭킹 `/ranking` (screens-v3 §11, 설계 §9) — 탭 3종 + 범위 토글(기본 = 내 국가).
// 국가 대항 탭은 범위 토글 없음(전 국가 비교) — RPC ranking_by_country가 국가 필터를 받지 않는다.
export function RankingPage() {
  const { t } = useTranslation()
  const { profile } = useCurrentUser()
  const myCountry = profile?.country ?? null

  const [tab, setTab] = useState<Tab>('by-set')
  const [scope, setScope] = useState<Scope>('mine')

  const country = scope === 'mine' ? myCountry : null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'by-set', label: t('ranking.tabBySet') },
    { key: 'overall', label: t('ranking.tabOverall') },
    { key: 'by-country', label: t('ranking.tabByCountry') },
  ]

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('ranking.title')}</h1>

      <div className={styles.tabs} role="tablist" aria-label={t('ranking.tabsAriaLabel')}>
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            type="button"
            role="tab"
            aria-selected={tab === tabItem.key}
            className={tab === tabItem.key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setTab(tabItem.key)}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab !== 'by-country' && (
        <div className={styles.scopeToggle}>
          <span className={styles.scopeLabel}>{t('ranking.scopeLabel')}</span>
          <button
            type="button"
            className={scope === 'mine' ? `${styles.scopeButton} ${styles.scopeButtonActive}` : styles.scopeButton}
            onClick={() => setScope('mine')}
          >
            {t('ranking.scopeMine')}{myCountry ? ` (${myCountry})` : ''}
          </button>
          <button
            type="button"
            className={scope === 'all' ? `${styles.scopeButton} ${styles.scopeButtonActive}` : styles.scopeButton}
            onClick={() => setScope('all')}
          >
            {t('common.all')}
          </button>
        </div>
      )}

      {tab === 'by-set' && <RankingBySetTab country={country} profile={profile} />}
      {tab === 'overall' && <RankingOverallTab country={country} profile={profile} />}
      {tab === 'by-country' && <RankingByCountryTab profile={profile} />}
    </div>
  )
}
