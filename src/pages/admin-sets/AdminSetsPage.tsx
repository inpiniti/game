import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAdminQuizSets, useDeleteQuizSet, type QuizSetWithCount } from '../../entities/quiz-set'
import { countryName } from '../../shared/config/countries'
import { learnLangLabel } from '../../shared/config/languages'
import { EditSetSheet } from './EditSetSheet'
import { PromoteSetSheet } from './PromoteSetSheet'
import styles from './AdminSetsPage.module.css'

type Tab = 'official' | 'promote'
type Filter = string | null | 'ALL'

// learn_lang 필터 옵션을 en/ja/zh 등록 순 → 일반(null) 순으로 정렬한다(QuizSetListPage의 정렬 규칙과 동일).
function sortLangs(langs: (string | null)[]): (string | null)[] {
  return [...langs].sort((a, b) => {
    if (a === b) return 0
    if (a === null) return 1
    if (b === null) return -1
    return a.localeCompare(b)
  })
}

function countryLabel(code: string | null, t: TFunction, lang: string): string {
  if (code === null) return t('adminSets.countryCommon')
  return `${code} · ${countryName(code, lang)}`
}

// 관리 · 문제집 `/admin/sets` (screens-v3 §13) — [공식 문제집] 탭(국가·언어 필터 + 수정·삭제) +
// [개인 문제집 승격] 탭. RequireAdmin 가드 안에서만 렌더되지만, useAdminQuizSets 자체도 isAdmin일 때만 요청한다.
export function AdminSetsPage() {
  const { t, i18n } = useTranslation()
  const { data: sets, isLoading, isError } = useAdminQuizSets()
  const deleteSet = useDeleteQuizSet()

  const [tab, setTab] = useState<Tab>('official')
  const [countryFilter, setCountryFilter] = useState<Filter>('ALL')
  const [langFilter, setLangFilter] = useState<Filter>('ALL')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingSet, setEditingSet] = useState<QuizSetWithCount | null>(null)
  const [promotingSet, setPromotingSet] = useState<QuizSetWithCount | null>(null)

  const officialSets = useMemo(() => (sets ?? []).filter((s) => s.is_official), [sets])
  const personalSets = useMemo(() => (sets ?? []).filter((s) => !s.is_official), [sets])

  const countryOptions = useMemo(() => {
    const codes = new Set(officialSets.map((s) => s.country))
    return [...codes].sort((a, b) => {
      if (a === b) return 0
      if (a === null) return -1
      if (b === null) return 1
      return a.localeCompare(b)
    })
  }, [officialSets])

  const langOptions = useMemo(
    () => sortLangs([...new Set(officialSets.map((s) => s.learn_lang))]),
    [officialSets],
  )

  const filteredOfficial = useMemo(
    () =>
      officialSets.filter((s) => {
        const countryOk = countryFilter === 'ALL' || s.country === countryFilter
        const langOk = langFilter === 'ALL' || s.learn_lang === langFilter
        return countryOk && langOk
      }),
    [officialSets, countryFilter, langFilter],
  )

  // confirmDeleteId를 여기서 바로 지우지 않는다 — 삭제가 끝나면 목록 무효화로 이 행 자체가 사라지므로
  // 그 전까지는 [삭제하기] 버튼의 pending 표시(아래 aria-busy)가 그대로 보여야 한다.
  const handleDelete = (setId: string) => {
    deleteSet.mutate(setId)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('adminSets.title')}</h1>
        <Link to="/admin/upload" className={styles.uploadLink}>
          {t('adminSets.uploadLink')}
        </Link>
      </header>

      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === 'official' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setTab('official')}
        >
          {t('adminSets.tabOfficial')}
        </button>
        <button
          type="button"
          className={tab === 'promote' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setTab('promote')}
        >
          {t('adminSets.tabPromote')}
        </button>
      </div>

      {isLoading && <p className={styles.notice}>{t('adminSets.loading')}</p>}
      {!isLoading && isError && (
        <p className={styles.notice}>{t('adminSets.loadError')}</p>
      )}

      {!isLoading && !isError && tab === 'official' && (
        <>
          <div className={styles.filterBar}>
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>{t('common.country')}</span>
              <div className={styles.chipRow}>
                <button
                  type="button"
                  className={countryFilter === 'ALL' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                  onClick={() => setCountryFilter('ALL')}
                >
                  {t('common.all')}
                </button>
                {countryOptions.map((code) => (
                  <button
                    key={code ?? 'common'}
                    type="button"
                    className={countryFilter === code ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                    onClick={() => setCountryFilter(code)}
                  >
                    {countryLabel(code, t, i18n.language)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>{t('common.language')}</span>
              <div className={styles.chipRow}>
                <button
                  type="button"
                  className={langFilter === 'ALL' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                  onClick={() => setLangFilter('ALL')}
                >
                  {t('common.all')}
                </button>
                {langOptions.map((code) => (
                  <button
                    key={code ?? 'general'}
                    type="button"
                    className={langFilter === code ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                    onClick={() => setLangFilter(code)}
                  >
                    {learnLangLabel(code)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredOfficial.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyEmoji}>📭</p>
              <p className={styles.emptyTitle}>{t('adminSets.emptyFilteredTitle')}</p>
              <p className={styles.emptyDesc}>{t('adminSets.emptyFilteredDesc')}</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {filteredOfficial.map((set) => (
                <li key={set.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTitle}>{set.title}</span>
                    <span className={styles.rowMeta}>
                      {countryLabel(set.country, t, i18n.language)} · {learnLangLabel(set.learn_lang)} ·{' '}
                      {t('common.wordCount', { count: set.itemCount })}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.editButton} onClick={() => setEditingSet(set)}>
                      {t('common.edit')}
                    </button>
                    {confirmDeleteId === set.id ? (
                      <>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          onClick={() => handleDelete(set.id)}
                          disabled={deleteSet.isPending}
                          aria-busy={deleteSet.isPending}
                        >
                          {deleteSet.isPending ? t('adminSets.deleting') : t('adminSets.deleteConfirm')}
                        </button>
                        <button
                          type="button"
                          className={styles.ghostButton}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {t('common.close')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => setConfirmDeleteId(set.id)}
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {!isLoading && !isError && tab === 'promote' && (
        <>
          {personalSets.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyEmoji}>📭</p>
              <p className={styles.emptyTitle}>{t('adminSets.emptyPromoteTitle')}</p>
              <p className={styles.emptyDesc}>{t('adminSets.emptyPromoteDesc')}</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {personalSets.map((set) => (
                <li key={set.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTitle}>{set.title}</span>
                    <span className={styles.rowMeta}>
                      {learnLangLabel(set.learn_lang)} · {t('common.wordCount', { count: set.itemCount })} ·{' '}
                      {t('adminSets.personalSetBadge')}
                    </span>
                  </div>
                  <button type="button" className={styles.promoteButton} onClick={() => setPromotingSet(set)}>
                    {t('adminSets.promoteButton')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <EditSetSheet set={editingSet} onClose={() => setEditingSet(null)} />
      <PromoteSetSheet set={promotingSet} onClose={() => setPromotingSet(null)} />
    </div>
  )
}
