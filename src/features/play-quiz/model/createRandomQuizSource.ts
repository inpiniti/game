import type { QuizItem } from '../../../entities/quiz-item'
import { splitVariants } from '../../../shared/lib/answer'
import type { AnswerLog, QuizQuestion, QuizSource } from './contract'

export type Direction = 'front-back' | 'back-front'

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 단계 3 출제원: SRS 없이 무작위 3지선다. 단계 7에서 SRS 기반으로 교체.
// direction: 'front-back' = 앞을 보고 뒤(뜻)를 맞힘 / 'back-front' = 뒤를 보고 앞을 맞힘
export function createRandomQuizSource(
  items: QuizItem[],
  direction: Direction,
  onReport?: (log: AnswerLog) => void,
): QuizSource {
  const sideOf = (it: QuizItem) => (direction === 'front-back' ? it.back : it.front)
  const promptOf = (it: QuizItem) => (direction === 'front-back' ? it.front : it.back)

  return {
    next(): QuizQuestion | null {
      if (items.length === 0) return null
      const item = pick(items)
      const prompt = splitVariants(promptOf(item))[0] ?? promptOf(item)
      const correctVariants = splitVariants(sideOf(item))
      const correct = correctVariants[0] ?? sideOf(item)

      // 오답 선지: 다른 항목의 대표 표기 중 정답 변형과 겹치지 않는 것 최대 2개
      const distractPool = [
        ...new Set(
          items
            .filter((it) => it.id !== item.id)
            .map((it) => splitVariants(sideOf(it))[0])
            .filter((d): d is string => !!d && !correctVariants.includes(d)),
        ),
      ]
      const distractors = shuffle(distractPool).slice(0, 2)

      const choices = shuffle([correct, ...distractors])
      const correctIndices = choices
        .map((c, i) => (correctVariants.includes(c) ? i : -1))
        .filter((i) => i >= 0)

      return {
        itemId: item.id,
        prompt,
        mode: 'choice',
        choices,
        correctIndices,
        answers: correctVariants,
        example: item.example ?? undefined,
      }
    },
    report(log: AnswerLog) {
      onReport?.(log)
    },
  }
}
