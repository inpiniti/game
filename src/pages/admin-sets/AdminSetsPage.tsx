import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminQuizSets, useDeleteQuizSet, type QuizSetWithCount } from '../../entities/quiz-set'
import { findCountry } from '../../shared/config/countries'
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

function countryLabel(code: string | null): string {
  if (code === null) return '공통'
  return `${code} · ${findCountry(code)?.nameKo ?? ''}`
}

// 관리 · 문제집 `/admin/sets` (screens-v3 §13) — [공식 문제집] 탭(국가·언어 필터 + 수정·삭제) +
// [개인 문제집 승격] 탭. RequireAdmin 가드 안에서만 렌더되지만, useAdminQuizSets 자체도 isAdmin일 때만 요청한다.
export function AdminSetsPage() {
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
        <h1 className={styles.title}>문제집 관리</h1>
        <Link to="/admin/upload" className={styles.uploadLink}>
          + 공식 문제집 업로드
        </Link>
      </header>

      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === 'official' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setTab('official')}
        >
          공식 문제집
        </button>
        <button
          type="button"
          className={tab === 'promote' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setTab('promote')}
        >
          개인 문제집 승격
        </button>
      </div>

      {isLoading && <p className={styles.notice}>불러오는 중이에요…</p>}
      {!isLoading && isError && (
        <p className={styles.notice}>목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      )}

      {!isLoading && !isError && tab === 'official' && (
        <>
          <div className={styles.filterBar}>
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>국가</span>
              <div className={styles.chipRow}>
                <button
                  type="button"
                  className={countryFilter === 'ALL' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                  onClick={() => setCountryFilter('ALL')}
                >
                  전체
                </button>
                {countryOptions.map((code) => (
                  <button
                    key={code ?? 'common'}
                    type="button"
                    className={countryFilter === code ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                    onClick={() => setCountryFilter(code)}
                  >
                    {countryLabel(code)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>언어</span>
              <div className={styles.chipRow}>
                <button
                  type="button"
                  className={langFilter === 'ALL' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                  onClick={() => setLangFilter('ALL')}
                >
                  전체
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
              <p className={styles.emptyTitle}>조건에 맞는 공식 문제집이 없어요</p>
              <p className={styles.emptyDesc}>다른 국가·언어 필터를 확인해 보세요</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {filteredOfficial.map((set) => (
                <li key={set.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTitle}>{set.title}</span>
                    <span className={styles.rowMeta}>
                      {countryLabel(set.country)} · {learnLangLabel(set.learn_lang)} · 단어 {set.itemCount}개
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.editButton} onClick={() => setEditingSet(set)}>
                      수정
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
                          {deleteSet.isPending ? '삭제하고 있어요…' : '삭제하기'}
                        </button>
                        <button
                          type="button"
                          className={styles.ghostButton}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          닫기
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => setConfirmDeleteId(set.id)}
                      >
                        삭제
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
              <p className={styles.emptyTitle}>승격할 개인 문제집이 없어요</p>
              <p className={styles.emptyDesc}>유저가 개인 문제집을 올리면 여기서 확인할 수 있어요</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {personalSets.map((set) => (
                <li key={set.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTitle}>{set.title}</span>
                    <span className={styles.rowMeta}>
                      {learnLangLabel(set.learn_lang)} · 단어 {set.itemCount}개 · 개인 문제집
                    </span>
                  </div>
                  <button type="button" className={styles.promoteButton} onClick={() => setPromotingSet(set)}>
                    승격
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
