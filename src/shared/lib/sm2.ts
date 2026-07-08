// SM-2 등급 갱신 (설계 §7-2). 등급은 again(오답)/good(정답) 2개만 사용.
// save-session(영속)과 출제 엔진(in-memory)이 같은 규칙을 쓰도록 단일 소스로 둔다.
export interface Sm2Card {
  ease_factor: number
  interval_days: number
  repetition: number
  lapses: number
}

// srs_progress에 행이 없는 새 단어 기본값 (docs/sql/01-init.sql 컬럼 기본값과 동일).
export const DEFAULT_SM2_CARD: Sm2Card = {
  ease_factor: 2.5,
  interval_days: 0,
  repetition: 0,
  lapses: 0,
}

const MIN_EASE_FACTOR = 1.3

// again: repetition/interval 초기화 + lapses 누적 + ease 하락
// good: repetition 누적, interval 1→6→ease배, ease 상승
export function applySm2Grade(card: Sm2Card, correct: boolean): Sm2Card {
  if (!correct) {
    return {
      ease_factor: Math.max(MIN_EASE_FACTOR, card.ease_factor - 0.2),
      interval_days: 0,
      repetition: 0,
      lapses: card.lapses + 1,
    }
  }

  const repetition = card.repetition + 1
  const interval_days =
    repetition === 1 ? 1 : repetition === 2 ? 6 : Math.round(card.interval_days * card.ease_factor)

  return {
    ease_factor: Math.max(MIN_EASE_FACTOR, card.ease_factor + 0.1),
    interval_days,
    repetition,
    lapses: card.lapses,
  }
}
