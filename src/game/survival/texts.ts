// 게임 내 표시 문자열 계약 — 게임은 i18n을 모른다(설계 v9 13-3).
// PlayPage가 t()로 만든 번역 사전을 createSurvivalGame에 주입하고, 씬은 받은 문자열을 그리기만 한다.
// 미주입/부분 주입 시 ko 기본값으로 동작(하위 호환). HUD는 "라벨 + 값" 조합이라 라벨만 담는다.

export interface SurvivalUpgradeText {
  name: string
  desc: string
}

export interface SurvivalTexts {
  instructions: string
  redeemed: string // 적 구원 플로팅 텍스트
  goldQuiz: string // 골드 획득 플로팅 텍스트
  blessingGained: string // 토스트 접두 라벨 — 씬이 `${blessingGained}: ${이름}`으로 조합
  blessingsTitle: string
  blessingsEmpty: string
  close: string
  hudTime: string
  hudRedeemed: string
  hudNextQuiz: string
  hudPierce: string
  hudQuiz: string
  upgrades: Record<string, SurvivalUpgradeText> // 키 = upgrades.js의 id
}

export const DEFAULT_SURVIVAL_TEXTS: SurvivalTexts = {
  instructions: '이동: 화살표 / 화면 터치(캐릭터 기준 누른 방향)   ·   무기가 자동으로 적을 구원합니다',
  redeemed: '구원됨',
  goldQuiz: '골드 획득! 퀴즈',
  blessingGained: '축복 획득',
  blessingsTitle: '획득한 축복',
  blessingsEmpty: '아직 획득한 축복이 없습니다',
  close: '닫기',
  hudTime: '시간',
  hudRedeemed: '구원',
  hudNextQuiz: '다음 퀴즈까지',
  hudPierce: '관통',
  hudQuiz: '퀴즈',
  upgrades: {
    arrow_count: { name: '다중 화살', desc: '화살 개수 +1' },
    arrow_rate: { name: '빠른 손놀림', desc: '화살 발사 속도 증가' },
    arrow_pierce: { name: '관통', desc: '관통 확률 +10%' },
  },
}

export function mergeSurvivalTexts(partial?: Partial<SurvivalTexts>): SurvivalTexts {
  return {
    ...DEFAULT_SURVIVAL_TEXTS,
    ...partial,
    upgrades: { ...DEFAULT_SURVIVAL_TEXTS.upgrades, ...(partial?.upgrades ?? {}) },
  }
}
