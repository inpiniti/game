import { useCallback, useRef, useState } from 'react'
import type { AnswerLog, QuizQuestion, QuizSource } from './contract'

interface Current {
  q: QuizQuestion
  seq: number // 오버레이 remount 키 (같은 문항이 연속돼도 상태 리셋)
  resolve: (r: { correct: boolean }) => void
}

// 씬의 requestQuiz()와 React 오버레이를 잇는 컨트롤러.
// requestQuiz(): 씬이 호출 → 오버레이를 띄우고 Promise 반환.
// answer(): 오버레이가 호출 → 채점·report·resolve 하고 오버레이를 닫음.
export function useQuizController(source: QuizSource | null) {
  const [current, setCurrent] = useState<Current | null>(null)
  const seqRef = useRef(0)
  const answersRef = useRef<AnswerLog[]>([]) // 단계 4(save-session)에서 소비

  const requestQuiz = useCallback((): Promise<{ correct: boolean }> => {
    return new Promise((resolve) => {
      const q = source?.next() ?? null
      if (!q) {
        resolve({ correct: false })
        return
      }
      setCurrent({ q, seq: ++seqRef.current, resolve })
    })
  }, [source])

  // 오버레이가 채점 결과(correct)와 사용자가 낸 답(given)을 넘겨준다 — choice/input 공통.
  const answer = useCallback(
    (correct: boolean, given: string) => {
      setCurrent((cur) => {
        if (!cur) return null
        const log: AnswerLog = { itemId: cur.q.itemId, given, correct }
        answersRef.current.push(log)
        source?.report(log)
        cur.resolve({ correct })
        return null
      })
    },
    [source],
  )

  return { current, requestQuiz, answer, answersRef }
}
