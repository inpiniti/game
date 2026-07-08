import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import type { AnswerLog, Direction } from '../../play-quiz'
import { applySm2Grade, DEFAULT_SM2_CARD, type Sm2Card } from './sm2'

export interface SaveSessionInput {
  userId: string
  quizSetId: string
  direction: Direction
  score: number
  seconds: number
  answers: AnswerLog[]
}

const DAY_MS = 24 * 60 * 60 * 1000

// 이번 판 answers를 itemId별 "마지막 응답 1건"으로 합친다 (같은 단어를 여러 번 만났으면 최신 결과로만 갱신).
function lastAnswerPerItem(answers: AnswerLog[]): Map<string, AnswerLog> {
  const map = new Map<string, AnswerLog>()
  for (const log of answers) map.set(log.itemId, log)
  return map
}

async function upsertSrsProgress(userId: string, answers: AnswerLog[]): Promise<void> {
  const lastByItem = lastAnswerPerItem(answers)
  const itemIds = [...lastByItem.keys()]
  if (itemIds.length === 0) return

  // 기존 SM-2 상태 조회 (없는 단어는 DEFAULT_SM2_CARD로 처리)
  const { data: existingRows, error: fetchError } = await supabase
    .from('srs_progress')
    .select('quiz_item_id, ease_factor, interval_days, repetition, lapses')
    .eq('user_id', userId)
    .in('quiz_item_id', itemIds)
  if (fetchError) throw fetchError

  const existingByItem = new Map<string, Sm2Card>(
    (existingRows ?? []).map((row) => [
      row.quiz_item_id as string,
      {
        ease_factor: row.ease_factor as number,
        interval_days: row.interval_days as number,
        repetition: row.repetition as number,
        lapses: row.lapses as number,
      },
    ]),
  )

  const now = new Date()
  const rows = itemIds.map((itemId) => {
    const log = lastByItem.get(itemId)!
    const prevCard = existingByItem.get(itemId) ?? DEFAULT_SM2_CARD
    const nextCard = applySm2Grade(prevCard, log.correct)
    // again → 즉시 다음 판 우선 출제(due_at=now) / good → now + interval_days일 뒤 재노출
    const dueAt = log.correct ? new Date(now.getTime() + nextCard.interval_days * DAY_MS) : now

    return {
      user_id: userId,
      quiz_item_id: itemId,
      ease_factor: nextCard.ease_factor,
      interval_days: nextCard.interval_days,
      repetition: nextCard.repetition,
      lapses: nextCard.lapses,
      due_at: dueAt.toISOString(),
      last_reviewed_at: now.toISOString(),
    }
  })

  const { error: upsertError } = await supabase
    .from('srs_progress')
    .upsert(rows, { onConflict: 'user_id,quiz_item_id' })
  if (upsertError) throw upsertError
}

// 게임오버 시 1회 write: 히스토리 insert + SRS(SM-2) upsert (설계 §7-2·§8).
// user_set_best는 play_histories insert 트리거가 자동 갱신 — 여기서는 건드리지 않는다.
// seconds는 계약상 입력으로 받지만 play_histories에는 저장할 컬럼이 없어(스키마 변경 금지) 영속하지 않는다.
export function useSaveSession() {
  return useMutation({
    mutationFn: async (input: SaveSessionInput): Promise<void> => {
      const correctCount = input.answers.filter((a) => a.correct).length
      const wrongItems = input.answers
        .filter((a) => !a.correct)
        .map((a) => ({ item_id: a.itemId, given: a.given }))

      const { error: historyError } = await supabase.from('play_histories').insert({
        user_id: input.userId,
        quiz_set_id: input.quizSetId,
        game_type: 'survival',
        settings: { direction: input.direction },
        score: input.score,
        correct_count: correctCount,
        total_count: input.answers.length,
        wrong_items: wrongItems,
      })
      if (historyError) throw historyError

      await upsertSrsProgress(input.userId, input.answers)
    },
  })
}
