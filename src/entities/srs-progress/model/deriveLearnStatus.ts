import { i18n } from '../../../shared/i18n'
import type { SrsProgress } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

export type LearnStatusKind = 'new' | 'learning' | 'review'

// 문제집 상세(screens-v3 §7)의 "학습 상태" 배지 — 3가지 중 하나로 표시한다.
export interface LearnStatus {
  kind: LearnStatusKind
  label: string // '미학습' | '학습 중' | 'n일 뒤 복습'
  lapses: number // 누적 오답 — "자주 틀리는 단어" 정렬 기준(값 자체는 상태 라벨과 별개로 노출)
}

/**
 * srs_progress 한 행(없으면 undefined)으로 학습 상태를 판정한다.
 *
 * 규칙(가정 — 설계 §7 SM-2 파라미터를 다음과 같이 매핑):
 * - 행이 없다 → 미학습(new): 한 번도 출제된 적 없는 단어.
 * - 행은 있지만 repetition < 2 이거나 복습 예정일(due_at)이 이미 지났다(오늘 이내 포함)
 *   → 학습 중(learning): 아직 SM-2의 안정적인 장기 간격에 들어서지 못한 상태.
 * - repetition >= 2 이고 due_at이 미래 → n일 뒤 복습(review): 다음 노출까지 남은 일수를 올림 표시.
 */
export function deriveLearnStatus(progress: SrsProgress | undefined, now: Date = new Date()): LearnStatus {
  if (!progress) return { kind: 'new', label: i18n.t('srsProgress.status.new'), lapses: 0 }

  const dueInDays = Math.ceil((new Date(progress.due_at).getTime() - now.getTime()) / DAY_MS)

  if (progress.repetition < 2 || dueInDays <= 0) {
    return { kind: 'learning', label: i18n.t('srsProgress.status.learning'), lapses: progress.lapses }
  }

  return {
    kind: 'review',
    label: i18n.t('srsProgress.status.review', { count: dueInDays }),
    lapses: progress.lapses,
  }
}

/** "⚠ 자주 틀리는 단어" 상위 N개 — lapses > 0인 항목을 내림차순으로 정렬한다. */
export function topLapsedProgress(progress: SrsProgress[], limit = 5): SrsProgress[] {
  return [...progress]
    .filter((p) => p.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses)
    .slice(0, limit)
}
