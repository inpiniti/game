import { useRef, useState } from 'react'
import type { QuizQuestion } from '../../features/play-quiz'
import { gradeInput, normalize } from '../../shared/lib/answer'
import styles from './QuizOverlay.module.css'

interface Props {
  question: QuizQuestion
  onAnswer: (correct: boolean, given: string) => void
}

const CHOICE_REVEAL_MS = 850
const INPUT_REVEAL_MS = 1500

// 퀴즈 오버레이 (DOM 레이어, 게임 일시정지 중). mode로 3지선다/직접입력 분기(설계 §7-3, §9).
export function QuizOverlay({ question, onAnswer }: Props) {
  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        {question.mode === 'input' ? (
          <InputView question={question} onAnswer={onAnswer} />
        ) : (
          <ChoiceView question={question} onAnswer={onAnswer} />
        )}
      </div>
    </div>
  )
}

function Prompt({ question }: { question: QuizQuestion }) {
  return (
    <p className={styles.prompt}>
      <b>{question.prompt}</b>
      <span className={styles.hint}> 의 뜻은?</span>
    </p>
  )
}

// 낯선 단어(repetition 0~1): 3지선다
function ChoiceView({ question, onAnswer }: Props) {
  const [chosen, setChosen] = useState<number | null>(null)
  const revealed = chosen !== null

  function handleClick(i: number) {
    if (revealed) return
    setChosen(i)
    const correct = question.correctIndices.includes(i)
    window.setTimeout(() => onAnswer(correct, question.choices[i]), CHOICE_REVEAL_MS)
  }

  return (
    <>
      <Prompt question={question} />
      <div className={styles.choices}>
        {question.choices.map((c, i) => {
          const isCorrect = question.correctIndices.includes(i)
          let state = ''
          if (revealed) {
            if (isCorrect) state = styles.correct
            else if (i === chosen) state = styles.wrong
            else state = styles.dim
          }
          return (
            <button
              key={i}
              type="button"
              className={`${styles.choice} ${state}`}
              onClick={() => handleClick(i)}
              disabled={revealed}
            >
              {revealed && isCorrect && '✅ '}
              {revealed && !isCorrect && i === chosen && '❌ '}
              {c}
            </button>
          )
        })}
      </div>
      {revealed && question.example && <p className={styles.example}>💬 {question.example}</p>}
    </>
  )
}

// 익은 단어(repetition≥2, 자동 승급): 직접입력. 복수 뜻이면 입력창 N개.
function InputView({ question, onAnswer }: Props) {
  const n = Math.max(1, question.answers.length)
  const [values, setValues] = useState<string[]>(() => Array(n).fill(''))
  const [submitted, setSubmitted] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const normAnswers = question.answers.map(normalize)
  const fieldCorrect = (i: number) => {
    const v = normalize(values[i] ?? '')
    return v !== '' && normAnswers.includes(v)
  }
  const matched = new Set(values.map(normalize).filter((v) => v && normAnswers.includes(v)))
  const missed = question.answers.filter((a) => !matched.has(normalize(a)))

  function submit() {
    if (submitted) return
    setSubmitted(true)
    const correct = gradeInput(values, question.answers)
    window.setTimeout(() => onAnswer(correct, values.filter(Boolean).join('; ')), INPUT_REVEAL_MS)
  }

  function handleKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (i < n - 1) refs.current[i + 1]?.focus()
    else submit()
  }

  return (
    <>
      <Prompt question={question} />
      {n > 1 && <p className={styles.subhint}>※ 뜻 {n}개를 입력해요</p>}
      <div className={styles.inputs}>
        {values.map((v, i) => (
          <div key={i} className={styles.inputRow}>
            <input
              ref={(el) => {
                refs.current[i] = el
              }}
              className={styles.input}
              value={v}
              disabled={submitted}
              autoFocus={i === 0}
              placeholder={`답 ${i + 1}`}
              onChange={(e) =>
                setValues((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
              }
              onKeyDown={(e) => handleKeyDown(e, i)}
            />
            {submitted && (
              <span className={`${styles.mark} ${fieldCorrect(i) ? styles.markOk : styles.markNo}`}>
                {fieldCorrect(i) ? '✓' : '✗'}
              </span>
            )}
          </div>
        ))}
      </div>
      {!submitted && (
        <button type="button" className={styles.submit} onClick={submit}>
          제출
        </button>
      )}
      {submitted && missed.length > 0 && (
        <p className={styles.missed}>못 맞힌 뜻: {missed.join(', ')}</p>
      )}
      {submitted && question.example && <p className={styles.example}>💬 {question.example}</p>}
    </>
  )
}
