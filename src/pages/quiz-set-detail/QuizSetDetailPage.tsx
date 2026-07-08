import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCurrentUser } from '../../entities/user'
import { useQuizSet } from '../../entities/quiz-set'
import { useQuizItems, type QuizItem } from '../../entities/quiz-item'
import {
  deriveLearnStatus,
  topLapsedProgress,
  useSrsProgressBySet,
  type SrsProgress,
} from '../../entities/srs-progress'
import { learnLangLabel } from '../../shared/config/languages'
import { DirectionSheet, useStartPlay } from '../../widgets/direction-sheet'
import { QuizItemsEditor } from './QuizItemsEditor'
import styles from './QuizSetDetailPage.module.css'

// 문제집 상세 `/sets/:setId` (screens-v3 §7) — 단어 목록 + 내 학습 상태 + (본인 개인 문제집이면) 수정 진입.
export function QuizSetDetailPage() {
  const { setId } = useParams()
  const { session } = useCurrentUser()
  const { data: set, isLoading: setLoading, isError: setError } = useQuizSet(setId)
  const { data: items, isLoading: itemsLoading } = useQuizItems(setId)
  const { data: progress } = useSrsProgressBySet(setId)
  const [editing, setEditing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const isOwner = !!session?.user.id && !!set && !set.is_official && set.user_id === session.user.id

  const progressByItem = useMemo(() => {
    const map = new Map<string, SrsProgress>()
    for (const row of progress ?? []) map.set(row.quiz_item_id, row)
    return map
  }, [progress])

  const weakItems = useMemo(() => {
    const top = topLapsedProgress(progress ?? [], 5)
    const itemsById = new Map((items ?? []).map((item) => [item.id, item]))
    return top
      .map((p) => ({ progress: p, item: itemsById.get(p.quiz_item_id) }))
      .filter((entry): entry is { progress: SrsProgress; item: QuizItem } => !!entry.item)
  }, [progress, items])

  const { sheetOpen, closeSheet, direction, setDirection, requestStart, confirmStart } = useStartPlay(
    setId ?? '',
    set?.learn_lang ?? null,
  )

  if (setLoading || itemsLoading) {
    return <p className={styles.notice}>문제집을 불러오는 중이에요…</p>
  }

  if (setError || !set || !setId) {
    return (
      <div className={styles.notFound}>
        <p className={styles.notice}>문제집을 찾을 수 없어요.</p>
        <Link to="/sets" className={styles.backLink}>
          문제집 목록으로
        </Link>
      </div>
    )
  }

  const learnedCount = progress?.length ?? 0
  const totalCount = items?.length ?? 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link to="/sets" className={styles.backLink} aria-label="뒤로 가기">
            ← 뒤로
          </Link>
          {isOwner && !editing && (
            <button type="button" className={styles.editButton} onClick={() => setEditing(true)}>
              수정
            </button>
          )}
        </div>
        <h1 className={styles.title}>{set.title}</h1>
        <p className={styles.subtitle}>
          {learnLangLabel(set.learn_lang)} · 단어 {totalCount}개 · 학습 {learnedCount}/{totalCount}
        </p>
      </header>

      {editing ? (
        <QuizItemsEditor
          setId={setId}
          items={items ?? []}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          {weakItems.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>⚠ 자주 틀리는 단어</h2>
              <ul className={styles.weakList}>
                {weakItems.map(({ item, progress: p }) => (
                  <li key={item.id} className={styles.weakRow}>
                    <span className={styles.weakFront}>{item.front}</span>
                    <span className={styles.weakBack}>{item.back}</span>
                    <span className={styles.weakLapses}>오답 {p.lapses}회</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>전체 단어</h2>
            {totalCount === 0 ? (
              <p className={styles.emptyNotice}>아직 등록된 단어가 없어요.</p>
            ) : (
              <ul className={styles.itemList}>
                <li className={styles.itemHeaderRow}>
                  <span>단어</span>
                  <span>뜻</span>
                  <span>상태</span>
                </li>
                {(items ?? []).map((item) => {
                  const status = deriveLearnStatus(progressByItem.get(item.id))
                  const expanded = expandedId === item.id
                  return (
                    <li key={item.id} className={styles.itemRow}>
                      <button
                        type="button"
                        className={styles.itemRowButton}
                        onClick={() => item.example && setExpandedId(expanded ? null : item.id)}
                        aria-expanded={expanded}
                      >
                        <span className={styles.itemFront}>{item.front}</span>
                        <span className={styles.itemBack}>{item.back}</span>
                        <span className={`${styles.statusBadge} ${styles[`status_${status.kind}`]}`}>
                          {status.label}
                        </span>
                      </button>
                      {expanded && item.example && <p className={styles.example}>💬 {item.example}</p>}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className={styles.ctaBar}>
            <button type="button" className={styles.ctaButton} onClick={requestStart} disabled={totalCount === 0}>
              게임 시작
            </button>
          </div>

          <DirectionSheet
            open={sheetOpen}
            onClose={closeSheet}
            learnLang={set.learn_lang}
            direction={direction}
            onChangeDirection={setDirection}
            onStart={confirmStart}
          />
        </>
      )}
    </div>
  )
}
