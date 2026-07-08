// docs/sql/01-init.sql `srs_progress` 테이블과 대응 — SM-2 기반 출제 엔진의 데이터.
// 유저 × 단어 조합 1행. 복습 화면은 없지만 출제 순서(설계 §7)가 이 값을 근거로 삼는다.
export interface SrsProgress {
  user_id: string
  quiz_item_id: string
  ease_factor: number // SM-2 EF (최소 1.3)
  interval_days: number
  repetition: number // 연속 정답 (배치 해제·방식 승급 기준)
  lapses: number // 누적 오답 (취약 단어 기준: >= 8)
  due_at: string
  last_reviewed_at: string | null
}
