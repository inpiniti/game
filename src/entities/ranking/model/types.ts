// docs/sql/01-init.sql 랭킹 함수 3종의 반환 컬럼과 대응 (security definer, 로그인 유저만 실행 가능).
// user_id는 반환되지 않는다 — 화면에서 "내 순위"를 찾을 때는 nickname+country 조합으로 매칭한다
// (동일 닉네임이 같은 국가에 여러 명일 가능성은 감수 — pages/ranking에서 가정으로 문서화).

// 8-1. 문제집별 랭킹 (ranking_by_set) — 유저별 최고 점수
export interface RankingBySetRow {
  rank: number
  nickname: string
  country: string
  best_score: number
  achieved_at: string
}

// 8-2. 전체 랭킹 (ranking_overall) — 유저별 (문제집별 최고점) 평균 + 참여 문제집 수
export interface RankingOverallRow {
  rank: number
  nickname: string
  country: string
  avg_score: number
  sets_played: number
}

// 8-3. 국가 랭킹 (ranking_by_country) — 국가별 "유저 평균점의 평균" + 참여 인원
export interface RankingByCountryRow {
  rank: number
  country: string
  avg_score: number
  players: number
}
