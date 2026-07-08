import type { QuizSetWithCount } from '../../entities/quiz-set'
import { QuizSetCard } from './QuizSetCard'
import styles from './QuizSetGrid.module.css'

interface QuizSetGridProps {
  sets: QuizSetWithCount[]
  showDelete: boolean
  onDelete?: (set: QuizSetWithCount) => void
  deletingId?: string
  emptyTitle: string
  emptyDescription: string
}

// 문제집 카드 그리드 — 모바일 1열, 태블릿/데스크톱은 CSS 그리드로 자동 확장. 빈 상태는 피크엔드 규칙대로
// 이모지 + 해요체 안내를 함께 보여준다.
export function QuizSetGrid({
  sets,
  showDelete,
  onDelete,
  deletingId,
  emptyTitle,
  emptyDescription,
}: QuizSetGridProps) {
  if (sets.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyEmoji}>📭</p>
        <p className={styles.emptyTitle}>{emptyTitle}</p>
        <p className={styles.emptyDesc}>{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className={styles.grid}>
      {sets.map((set) => (
        <QuizSetCard
          key={set.id}
          set={set}
          showDelete={showDelete}
          onDelete={onDelete}
          deleting={deletingId === set.id}
        />
      ))}
    </div>
  )
}
