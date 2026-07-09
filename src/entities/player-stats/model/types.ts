// docs/sql/05-stats.sql `user_stats` 테이블과 1:1 대응 (설계 v10 §16-1).
// game/survival도 같은 모양의 PlayerStats를 선언한다 — game/은 FSD 밖이라 pages/play만
// import 하므로(설계 v9 §6 트리, "game/: FSD 밖, pages/play만 import"), 여기서는 독립적으로
// 재선언한다(구조적 타입 호환 — pages/play가 두 타입을 서로 대입해도 형태가 같아 문제없다).
export interface PlayerStats {
  level: number
  exp: number // 누적 경험치 총량
  str: number
  agi: number
  sta: number
  unspent: number // 미배분 스탯 포인트
}

// user_stats 행이 없을 때(구세션·백필 전 신규 유저 등) 폴백 기본값 — 레벨1, 나머지 전부 0.
export const DEFAULT_PLAYER_STATS: PlayerStats = {
  level: 1,
  exp: 0,
  str: 0,
  agi: 0,
  sta: 0,
  unspent: 0,
}
