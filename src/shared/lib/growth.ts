// 성장(레벨·경험치·스탯) 순수 계산 — 단일 권위 소스 (설계 v10 §14).
// 게임 씬(src/game/survival/*.js, FSD 밖 leaf)과 앱(features/pages/entities, TS)이 "둘 다"
// 이 모듈을 import 한다. 의존성 0 — Supabase·i18n·DOM·Phaser 무관한 순수 수학만이라,
// 씬 isolation(설계 §6)을 깨지 않고 클린하게 공유할 수 있다.
//
// ⚠️ MUST MATCH: docs/sql/05-stats.sql 의 apply_game_result (설계 v10 §16-2 상수 동기화).
//   경험치 티어(1/3/8) · 레벨 곡선(25*L^1.5) · 레벨당 포인트(1)는 서버(SQL)에도 복제된다.
//   두 곳이 어긋나면 배분 예산이 불일치한다. 여기 값을 바꾸면 05-stats.sql 도 함께 바꿔라.

// 처치 티어별 경험치 (§14-2). 서버가 exp_gain 을 계산할 때 쓰는 가중치와 동일해야 한다.
export const EXP_BY_TIER = { weak: 1, mid: 3, strong: 8 } as const

// 레벨업 1회당 미배분 스탯 포인트 (§14-3).
export const POINTS_PER_LEVEL = 1

// 접촉 전투 상수 (§15). 2단계(전투)가 소비한다.
export const CONTACT_DAMAGE = 1
export const IFRAME_MS = 800

// L → L+1 에 필요한 경험치 (§14-3, 튜닝 상수 25 * L^1.5).
export function expToNext(level: number): number {
  return Math.round(25 * level ** 1.5)
}

// 킬 티어 카운트 → 총 획득 경험치. 씬(2b, 레벨업 예측)과 앱(3, 결과 표시)이
// 티어 가중치를 각자 곱하지 않도록 EXP_BY_TIER 를 여기서 한 번만 적용한다.
export interface KillsByTier {
  weak: number
  mid: number
  strong: number
}
export function expForKills(kills: KillsByTier): number {
  return (
    kills.weak * EXP_BY_TIER.weak +
    kills.mid * EXP_BY_TIER.mid +
    kills.strong * EXP_BY_TIER.strong
  )
}

// 누적 경험치 총량에서 현재 레벨과 "이번 레벨 진행도"를 계산 (§14-3).
export interface LevelProgress {
  level: number // 현재 레벨 (1부터)
  expIntoLevel: number // 현재 레벨에서 지금까지 쌓은 경험치
  expForNext: number // 다음 레벨까지 필요한 총량 (= expToNext(level))
}
export function levelForExp(totalExp: number): LevelProgress {
  let level = 1
  let remaining = Math.max(0, Math.floor(totalExp))
  let need = expToNext(level)
  while (remaining >= need) {
    remaining -= need
    level += 1
    need = expToNext(level)
  }
  return { level, expIntoLevel: remaining, expForNext: need }
}

// 스탯 효과 공식 (§14-4). 전부 §12 튜닝 상수.
export function dmgMul(str: number): number {
  return 1 + 0.12 * str // 힘: 공격력 배수 (스탯 0 → ×1.0)
}
export function hitChance(agi: number): number {
  return Math.min(0.99, 0.85 + 0.02 * agi) // 민첩: 명중률 (기본 85%, 상한 99%)
}
export function dodgeChance(agi: number): number {
  return Math.min(0.6, 0.02 * agi) // 민첩: 회피율 (기본 0%, 상한 60%)
}
export function maxHp(sta: number): number {
  return 3 + 2 * sta // 체력: 최대 HP (스탯 0 → 3)
}
