import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/api/supabase'
import { playerStatsQueryKeys, type PlayerStats } from '../../../entities/player-stats'
import type { AnswerLog, Direction } from '../../play-quiz'
import { applySm2Grade, DEFAULT_SM2_CARD, type Sm2Card } from './sm2'

// 게임오버 시 씬이 반출하는 티어별 킬 수·이번 판 배분 델타(설계 v10 §17-2).
// apply_game_result RPC 인자로 그대로 넘어간다 — 서버가 경험치를 재계산하고 배분을 예산으로 캡한다.
export interface KillsByTier {
  weak: number
  mid: number
  strong: number
}
export interface StatAllocations {
  str: number
  agi: number
  sta: number
}

export interface SaveSessionInput {
  userId: string
  quizSetId: string
  direction: Direction
  score: number
  seconds: number
  answers: AnswerLog[]
  killsByTier: KillsByTier
  allocations: StatAllocations
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

// 게임오버 시 3회 write: 히스토리 insert + SRS(SM-2) upsert + apply_game_result RPC (설계 §7-2·§8·§17-2).
// user_set_best는 play_histories insert 트리거가 자동 갱신 — 여기서는 건드리지 않는다.
// seconds는 계약상 입력으로 받지만 play_histories에는 저장할 컬럼이 없어(스키마 변경 금지) 영속하지 않는다.
//
// RPC는 앞의 두 write와 같은 mutation 안에서 순서대로 호출한다 — 실패하면(네트워크 등)
// mutateAsync 전체가 reject되는데, 이는 기존 정책과 동일하다(호출부 PlayPage가 이미 saveSession
// 전체를 try/catch로 감싸 "저장 실패해도 결과 화면 진입은 막지 않는다"). RPC만 실패한 경우
// 레벨업 표시만 생략되고 결과 화면 자체는 정상 진입한다.
export function useSaveSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SaveSessionInput): Promise<PlayerStats> => {
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

      // 서버가 경험치를 킬 수에서 직접 재계산하고, 배분(allocations)을 미배분 포인트 예산으로
      // 캡 검증한다(docs/sql/05-stats.sql apply_game_result, 클라 신뢰 안 함). 갱신된 행을 반환.
      const { data: statsRow, error: statsError } = await supabase.rpc('apply_game_result', {
        p_kills_weak: input.killsByTier.weak,
        p_kills_mid: input.killsByTier.mid,
        p_kills_strong: input.killsByTier.strong,
        p_alloc_str: input.allocations.str,
        p_alloc_agi: input.allocations.agi,
        p_alloc_sta: input.allocations.sta,
      })
      if (statsError) throw statsError
      return statsRow as unknown as PlayerStats
    },
    onSuccess: (_stats, variables) => {
      // 헤더/프로필 시트가 새 레벨·스탯을 반영할 수 있도록 useUserStats 쿼리를 무효화한다(§17-2).
      queryClient.invalidateQueries({ queryKey: playerStatsQueryKeys.detail(variables.userId) })
    },
  })
}
