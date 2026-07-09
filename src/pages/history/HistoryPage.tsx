import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlayHistories, type PlayHistoryWithSet, type WrongItem } from '../../entities/history'
import { useQuizItems } from '../../entities/quiz-item'
import { splitVariants } from '../../shared/lib/answer'
import styles from './HistoryPage.module.css'

// yyyy.mm.dd hh:mm — 목록 정렬 기준(played_at)과 같은 값으로 표시한다.
function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function accuracyOf(h: PlayHistoryWithSet): number {
  return h.total_count > 0 ? Math.round((h.correct_count / h.total_count) * 100) : 0
}

// 기록 `/history` (screens-v3 §11) — 현재 유저의 play_histories를 최근순으로.
// 데스크톱 표 / 모바일 카드 리스트, 행 탭 → 틀린 단어(wrong_items) 펼침.
//
// 가정: 화면 설계상 "처치" 열이 있지만 play_histories 스키마(docs/sql/01-init.sql)에는 킬 수를
// 저장하는 컬럼이 없다(게임의 redeemedCount는 /result 화면 진입 시 state로만 잠깐 존재하고
// 영속되지 않음 — features/save-session/model/useSaveSession.ts 참고). 스키마·게임 코드를
// 건드리지 않기로 했으므로 "처치" 대신 실제로 저장되는 "정답(correct/total)"을 보여준다.
export function HistoryPage() {
  const { t, i18n } = useTranslation()
  const { data: histories, isLoading, isError } = usePlayHistories()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id))

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('history.title')}</h1>

      {isLoading && (
        <div className={styles.skeletonList}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <p className={styles.errorNotice}>{t('history.loadError')}</p>
      )}

      {!isLoading && !isError && (histories?.length ?? 0) === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyEmoji}>📭</p>
          <p className={styles.emptyTitle}>{t('common.noRecordsTitle')}</p>
          <p className={styles.emptyDesc}>{t('history.emptyDesc')}</p>
        </div>
      )}

      {!isLoading && !isError && (histories?.length ?? 0) > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('history.headerDate')}</th>
                <th>{t('history.headerSet')}</th>
                <th>{t('common.scoreLabel')}</th>
                <th>{t('history.headerCorrect')}</th>
                <th>{t('history.headerAccuracy')}</th>
              </tr>
            </thead>
            <tbody>
              {histories!.map((h) => {
                const expanded = expandedId === h.id
                return (
                  <Fragment key={h.id}>
                    <tr
                      className={styles.row}
                      onClick={() => toggle(h.id)}
                      aria-expanded={expanded}
                    >
                      <td>{formatDate(h.played_at)}</td>
                      <td>{h.setTitle ?? t('history.deletedSet')}</td>
                      <td>{h.score.toLocaleString(i18n.language)}</td>
                      <td>
                        {h.correct_count}/{h.total_count}
                      </td>
                      <td>{accuracyOf(h)}%</td>
                    </tr>
                    {expanded && (
                      <tr className={styles.expandRow}>
                        <td colSpan={5}>
                          <WrongItemsPanel quizSetId={h.quiz_set_id} wrongItems={h.wrong_items} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          <ul className={styles.cardList}>
            {histories!.map((h) => {
              const expanded = expandedId === h.id
              return (
                <li key={h.id} className={styles.card}>
                  <button
                    type="button"
                    className={styles.cardButton}
                    onClick={() => toggle(h.id)}
                    aria-expanded={expanded}
                  >
                    <div className={styles.cardTop}>
                      <span className={styles.cardSetTitle}>{h.setTitle ?? t('history.deletedSet')}</span>
                      <span className={styles.cardScore}>{t('common.scoreValue', { value: h.score.toLocaleString(i18n.language) })}</span>
                    </div>
                    <div className={styles.cardBottom}>
                      <span>{formatDate(h.played_at)}</span>
                      <span>
                        {t('history.cardAccuracyLine', {
                          correct: h.correct_count,
                          total: h.total_count,
                          accuracy: accuracyOf(h),
                        })}
                      </span>
                    </div>
                  </button>
                  {expanded && (
                    <div className={styles.cardExpand}>
                      <WrongItemsPanel quizSetId={h.quiz_set_id} wrongItems={h.wrong_items} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

interface WrongItemsPanelProps {
  quizSetId: string | null
  wrongItems: WrongItem[]
}

// 틀린 단어 펼침 — quiz_items(front/back)를 조인해 item_id를 실제 단어로 풀어 보여준다.
// 문제집이 삭제됐거나(quiz_set_id null) 단어가 그새 삭제됐으면 "삭제된 단어"로 대체 표기.
function WrongItemsPanel({ quizSetId, wrongItems }: WrongItemsPanelProps) {
  const { t } = useTranslation()
  const { data: items } = useQuizItems(quizSetId ?? undefined)

  const itemsById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items])

  if (wrongItems.length === 0) {
    return <p className={styles.wrongEmpty}>{t('common.allCorrectNotice')}</p>
  }

  return (
    <ul className={styles.wrongList}>
      {wrongItems.map((w, i) => {
        const item = itemsById.get(w.item_id)
        const back = item ? splitVariants(item.back)[0] ?? item.back : null
        return (
          <li key={`${w.item_id}-${i}`} className={styles.wrongRow}>
            <span className={styles.wrongFront}>{item?.front ?? t('history.deletedWord')}</span>
            <span className={styles.wrongGiven}>{w.given || t('common.noAnswer')}</span>
            <span className={styles.wrongBack}>{back ?? '-'}</span>
          </li>
        )
      })}
    </ul>
  )
}
