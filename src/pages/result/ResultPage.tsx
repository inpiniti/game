import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { splitVariants } from '../../shared/lib/answer'
import styles from './ResultPage.module.css'

interface WrongWord {
  front: string
  given: string
  back: string
}

// PlayPage의 onGameOver 핸들러가 navigate('/result', { state }) 로 넘기는 결과 요약 (설계 §8·§10).
export interface ResultState {
  score: number
  kills: number
  seconds: number
  correct: number
  total: number
  setId: string
  setTitle?: string
  wrongWords: WrongWord[]
}

function isResultState(state: unknown): state is ResultState {
  return (
    !!state &&
    typeof state === 'object' &&
    'score' in state &&
    'total' in state &&
    'wrongWords' in state
  )
}

// 게임오버 결과 화면 `/result`. 직전 세션 state 기반 — 새로고침·직접 진입 시 state가 없으므로 로비로 되돌린다.
export function ResultPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state

  if (!isResultState(state)) {
    return <Navigate to="/" replace />
  }

  const accuracy = state.total > 0 ? Math.round((state.correct / state.total) * 100) : 0

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <h1 className={styles.title}>게임 오버</h1>
        {state.setTitle && <p className={styles.subtitle}>{state.setTitle}</p>}

        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>점수</dt>
            <dd>{state.score.toLocaleString()}</dd>
          </div>
          <div className={styles.stat}>
            <dt>처치</dt>
            <dd>{state.kills.toLocaleString()}마리</dd>
          </div>
          <div className={styles.stat}>
            <dt>퀴즈</dt>
            <dd>
              {state.correct} / {state.total} ({accuracy}%)
            </dd>
          </div>
        </dl>

        <p className={styles.savedNotice}>✔ 기록 저장 · 다음에 또 나와요</p>
      </div>

      <section className={styles.wrongSection}>
        <h2 className={styles.sectionTitle}>틀린 단어</h2>
        {state.wrongWords.length === 0 ? (
          <p className={styles.emptyNotice}>😄 전부 맞혔어요! 틀린 단어가 없어요</p>
        ) : (
          <ul className={styles.wrongList}>
            {state.wrongWords.map((word, i) => (
              <WrongWordRow key={`${word.front}-${i}`} word={word} />
            ))}
          </ul>
        )}
      </section>

      <div className={styles.ctaRow}>
        <button type="button" className={styles.secondaryButton} onClick={() => navigate('/')}>
          로비로
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => navigate(`/play/${state.setId}`)}
        >
          다시하기
        </button>
      </div>
    </div>
  )
}

function WrongWordRow({ word }: { word: WrongWord }) {
  const [expanded, setExpanded] = useState(false)
  const variants = splitVariants(word.back)
  const [firstVariant, ...restVariants] = variants.length > 0 ? variants : [word.back]
  const hasMore = restVariants.length > 0

  return (
    <li className={styles.wrongRow}>
      <button
        type="button"
        className={styles.wrongRowButton}
        onClick={() => hasMore && setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.wrongFront}>{word.front}</span>
        <span className={styles.wrongGiven}>{word.given || '(무응답)'}</span>
        <span className={styles.wrongBack}>
          {firstVariant}
          {hasMore && !expanded ? ' 외' : ''}
        </span>
      </button>
      {expanded && hasMore && <p className={styles.wrongMore}>정답: {variants.join(', ')}</p>}
    </li>
  )
}
