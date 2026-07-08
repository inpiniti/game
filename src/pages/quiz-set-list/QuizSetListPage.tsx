import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../../entities/user'
import { useDeleteQuizSet, useQuizSets, type QuizSetWithCount } from '../../entities/quiz-set'
import { learnLangLabel } from '../../shared/config/languages'
import { BottomSheet } from '../../shared/ui/bottom-sheet/BottomSheet'
import { UploadQuizSetForm } from '../../features/upload-quiz-set'
import { QuizSetGrid } from '../../widgets/quiz-set-grid'
import styles from './QuizSetListPage.module.css'

type Scope = 'official' | 'mine'

// learn_lang 값들을 라벨 있는 순서(en/ja/zh 등록 순) → 일반(null) 순으로 정렬한다.
function sortLangs(langs: (string | null)[]): (string | null)[] {
  return [...langs].sort((a, b) => {
    if (a === b) return 0
    if (a === null) return 1
    if (b === null) return -1
    return a.localeCompare(b)
  })
}

// 문제집 선택 `/sets` (screens-v3 §6) — 언어 탭 × 구분 탭([공식]/[내 문제집]) + 업로드.
export function QuizSetListPage() {
  const navigate = useNavigate()
  const { session } = useCurrentUser()
  const userId = session?.user.id
  const { data: sets, isLoading, isError } = useQuizSets()
  const deleteSet = useDeleteQuizSet()

  const [scope, setScope] = useState<Scope>('official')
  const [lang, setLang] = useState<string | null | undefined>(undefined)
  const [uploadOpen, setUploadOpen] = useState(false)

  const availableLangs = useMemo(() => sortLangs([...new Set((sets ?? []).map((s) => s.learn_lang))]), [sets])

  // 데이터가 로드된 뒤 첫 번째 언어 탭을 기본 선택으로 잡는다.
  useEffect(() => {
    if (lang === undefined && availableLangs.length > 0) setLang(availableLangs[0])
  }, [availableLangs, lang])

  const filteredSets = useMemo(() => {
    if (lang === undefined) return []
    return (sets ?? []).filter((set) => {
      const inScope = scope === 'official' ? set.is_official : !set.is_official && set.user_id === userId
      return inScope && set.learn_lang === lang
    })
  }, [sets, scope, lang, userId])

  const handleDelete = (set: QuizSetWithCount) => {
    deleteSet.mutate(set.id)
  }

  const handleUploadSuccess = (newSetId: string) => {
    setUploadOpen(false)
    navigate(`/sets/${newSetId}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.filterBar}>
        {availableLangs.length > 0 && (
          <div className={styles.tabRow}>
            <span className={styles.tabRowLabel}>언어</span>
            <div className={styles.tabs}>
              {availableLangs.map((code) => (
                <button
                  key={code ?? 'general'}
                  type="button"
                  className={lang === code ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                  onClick={() => setLang(code)}
                >
                  {learnLangLabel(code)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.tabRow}>
          <span className={styles.tabRowLabel}>구분</span>
          <div className={styles.tabs}>
            <button
              type="button"
              className={scope === 'official' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setScope('official')}
            >
              공식
            </button>
            <button
              type="button"
              className={scope === 'mine' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setScope('mine')}
            >
              내 문제집
            </button>
          </div>
          <button type="button" className={styles.uploadButton} onClick={() => setUploadOpen(true)}>
            + 업로드
          </button>
        </div>
      </div>

      {isLoading && (
        <div className={styles.skeletonGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <p className={styles.errorNotice}>문제집을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      )}

      {!isLoading && !isError && (
        <QuizSetGrid
          sets={filteredSets}
          showDelete={scope === 'mine'}
          onDelete={handleDelete}
          deletingId={deleteSet.isPending ? deleteSet.variables : undefined}
          emptyTitle="아직 문제집이 없어요"
          emptyDescription={
            scope === 'mine' ? '+ 업로드로 첫 문제집을 만들어 보세요' : '다른 언어·구분 탭도 확인해 보세요'
          }
        />
      )}

      <BottomSheet open={uploadOpen} onClose={() => setUploadOpen(false)} title="문제집 업로드">
        {userId && <UploadQuizSetForm userId={userId} onSuccess={handleUploadSuccess} />}
      </BottomSheet>
    </div>
  )
}
