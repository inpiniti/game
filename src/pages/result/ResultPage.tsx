import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation()
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
        <h1 className={styles.title}>{t('result.title')}</h1>
        {state.setTitle && <p className={styles.subtitle}>{state.setTitle}</p>}

        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>{t('common.scoreLabel')}</dt>
            <dd>{state.score.toLocaleString(i18n.language)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('result.killsLabel')}</dt>
            <dd>{t('result.killsValue', { kills: state.kills.toLocaleString(i18n.language) })}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('result.quizLabel')}</dt>
            <dd>
              {state.correct} / {state.total} ({accuracy}%)
            </dd>
          </div>
        </dl>

        <p className={styles.savedNotice}>{t('result.savedNotice')}</p>
      </div>

      <section className={styles.wrongSection}>
        <h2 className={styles.sectionTitle}>{t('result.wrongTitle')}</h2>
        {state.wrongWords.length === 0 ? (
          <p className={styles.emptyNotice}>{t('common.allCorrectNotice')}</p>
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
          {t('result.toLobby')}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => navigate(`/play/${state.setId}`)}
        >
          {t('result.retry')}
        </button>
      </div>
    </div>
  )
}

function WrongWordRow({ word }: { word: WrongWord }) {
  const { t } = useTranslation()
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
        <span className={styles.wrongGiven}>{word.given || t('common.noAnswer')}</span>
        <span className={styles.wrongBack}>
          {firstVariant}
          {hasMore && !expanded ? t('result.moreSuffix') : ''}
        </span>
      </button>
      {expanded && hasMore && <p className={styles.wrongMore}>{t('result.answer', { list: variants.join(', ') })}</p>}
    </li>
  )
}
