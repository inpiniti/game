import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { QuizSetWithCount } from '../../entities/quiz-set'
import { useSetLearnCount } from '../../entities/srs-progress'
import { learnLangLabel } from '../../shared/config/languages'
import { DirectionSheet, useStartPlay } from '../direction-sheet'
import styles from './QuizSetGrid.module.css'

interface QuizSetCardProps {
  set: QuizSetWithCount
  showDelete: boolean
  onDelete?: (set: QuizSetWithCount) => void
  deleting?: boolean
}

// 문제집 선택(screens-v3 §6) 카드 — 제목 · 단어 수 · 학습 n/N · [문제집 보기]/[시작], [내 문제집] 탭엔 [삭제] 추가.
export function QuizSetCard({ set, showDelete, onDelete, deleting }: QuizSetCardProps) {
  const navigate = useNavigate()
  const { data: learnedCount } = useSetLearnCount(set.id)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { sheetOpen, closeSheet, direction, setDirection, requestStart, confirmStart } = useStartPlay(
    set.id,
    set.learn_lang,
  )

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.title}>{set.title}</h3>
        <span className={styles.langBadge}>{learnLangLabel(set.learn_lang)}</span>
      </div>

      <p className={styles.meta}>단어 {set.itemCount}개</p>
      <p className={styles.meta}>
        학습 {learnedCount ?? '…'}/{set.itemCount}
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={() => navigate(`/sets/${set.id}`)}>
          문제집 보기
        </button>
        <button type="button" className={styles.primaryButton} onClick={requestStart}>
          시작
        </button>
      </div>

      {showDelete &&
        (confirmingDelete ? (
          <div className={styles.confirmRow}>
            <span className={styles.confirmText}>삭제할까요?</span>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => onDelete?.(set)}
              disabled={deleting}
              aria-busy={deleting}
            >
              {deleting ? '삭제하고 있어요…' : '삭제하기'}
            </button>
            <button type="button" className={styles.ghostButton} onClick={() => setConfirmingDelete(false)}>
              닫기
            </button>
          </div>
        ) : (
          <button type="button" className={styles.deleteButton} onClick={() => setConfirmingDelete(true)}>
            삭제
          </button>
        ))}

      <DirectionSheet
        open={sheetOpen}
        onClose={closeSheet}
        learnLang={set.learn_lang}
        direction={direction}
        onChangeDirection={setDirection}
        onStart={confirmStart}
      />
    </div>
  )
}
