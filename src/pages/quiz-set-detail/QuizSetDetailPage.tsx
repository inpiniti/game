import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { categoryLabel } from '../../shared/config/categories'
import { DirectionSheet, useStartPlay } from '../../widgets/direction-sheet'
import { QuizItemsEditor } from './QuizItemsEditor'
import styles from './QuizSetDetailPage.module.css'

// 문제집 상세 `/sets/:setId` (screens-v3 §7) — 단어 목록 + 내 학습 상태 + (본인 개인 문제집이면) 수정 진입.
export function QuizSetDetailPage() {
  const { t } = useTranslation()
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
    return <p className={styles.notice}>{t('common.loadingQuizSet')}</p>
  }

  if (setError || !set || !setId) {
    return (
      <div className={styles.notFound}>
        <p className={styles.notice}>{t('quizSetDetail.notFound')}</p>
        <Link to="/sets" className={styles.backLink}>
          {t('quizSetDetail.backToList')}
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
          <Link to="/sets" className={styles.backLink} aria-label={t('common.goBack')}>
            {t('quizSetDetail.backLinkText')}
          </Link>
          {isOwner && !editing && (
            <button type="button" className={styles.editButton} onClick={() => setEditing(true)}>
              {t('common.edit')}
            </button>
          )}
        </div>
        <h1 className={styles.title}>{set.title}</h1>
        <p className={styles.subtitle}>
          {learnLangLabel(set.learn_lang)}
          {set.category && (
            <>
              {' '}·{' '}
              <span className={styles.categoryBadge}>{categoryLabel(set.category)}</span>
            </>
          )}
          {' '}· {t('common.wordCount', { count: totalCount })} ·{' '}
          {t('quizSetDetail.learnedProgress', { learned: learnedCount, total: totalCount })}
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
              <h2 className={styles.sectionTitle}>{t('quizSetDetail.weakSectionTitle')}</h2>
              <ul className={styles.weakList}>
                {weakItems.map(({ item, progress: p }) => (
                  <li key={item.id} className={styles.weakRow}>
                    <span className={styles.weakFront}>{item.front}</span>
                    <span className={styles.weakBack}>{item.back}</span>
                    <span className={styles.weakLapses}>{t('quizSetDetail.wrongCount', { count: p.lapses })}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('quizSetDetail.allWordsTitle')}</h2>
            {totalCount === 0 ? (
              <p className={styles.emptyNotice}>{t('quizSetDetail.emptyItems')}</p>
            ) : (
              <ul className={styles.itemList}>
                <li className={styles.itemHeaderRow}>
                  <span>{t('quizSetDetail.headerWord')}</span>
                  <span>{t('quizSetDetail.headerMeaning')}</span>
                  <span>{t('quizSetDetail.headerStatus')}</span>
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
              {t('common.startGame')}
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
