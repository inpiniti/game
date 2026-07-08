import type { Direction } from '../../features/play-quiz'
import { learnLangShort } from '../../shared/config/languages'
import { BottomSheet } from '../../shared/ui/bottom-sheet/BottomSheet'
import styles from './DirectionSheet.module.css'

interface DirectionSheetProps {
  open: boolean
  onClose: () => void
  /** null(일반 문제집)이면 이 시트 자체를 쓰지 않는다 — 호출부(useStartPlay)가 열지 않는다. */
  learnLang: string | null
  direction: Direction
  onChangeDirection: (direction: Direction) => void
  onStart: () => void
}

// 방향 선택 시트(screens-v3 §8) — 마지막 선택은 호출부(useStartPlay)가 localStorage로 기억한다.
export function DirectionSheet({
  open,
  onClose,
  learnLang,
  direction,
  onChangeDirection,
  onStart,
}: DirectionSheetProps) {
  const short = learnLangShort(learnLang)

  const options: { value: Direction; title: string; hint: string }[] = [
    { value: 'front-back', title: `${short} 보고 뜻 맞히기`, hint: '단어 → 뜻' },
    { value: 'back-front', title: `뜻 보고 ${short} 맞히기`, hint: '뜻 → 단어' },
  ]

  return (
    <BottomSheet open={open} onClose={onClose} title="어느 방향으로 할까요?">
      <div className={styles.options}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === direction ? `${styles.option} ${styles.optionActive}` : styles.option}
            onClick={() => onChangeDirection(option.value)}
          >
            <span className={styles.radio} aria-hidden />
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>{option.title}</span>
              <span className={styles.optionHint}>{option.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <button type="button" className={styles.startButton} onClick={onStart}>
        게임 시작
      </button>
    </BottomSheet>
  )
}
