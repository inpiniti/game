// 게임 내 표시 문자열 계약 — 게임은 i18n을 모른다(설계 v9 13-3).
// PlayPage가 t()로 만든 번역 사전을 createSurvivalGame에 주입하고, 씬은 받은 문자열을 그리기만 한다.
// 미주입/부분 주입 시 ko 기본값으로 동작(하위 호환). HUD는 "라벨 + 값" 조합이라 라벨만 담는다.

export interface SurvivalUpgradeText {
  name: string
  desc: string
}

// 레벨업 배분 오버레이(§18-1)의 스탯 1개 표시 단위 — upgrades와 동일한 name/desc 모양이라 재사용하지 않고
// 의미를 분리(스탯은 성장 축, upgrades는 축복 축 — 설계 §14-1)해 별도 타입으로 둔다.
export interface SurvivalStatText {
  name: string
  desc: string
}

export interface SurvivalTexts {
  instructions: string
  redeemed: string // 적 구원 플로팅 텍스트
  // 전투 플로팅 텍스트(2a 신설). 앱이 아직 game.dodge/game.miss 번역을 주입하지 않아 optional —
  // 미주입이면 mergeSurvivalTexts가 아래 ko 기본값('회피!'/'빗나감')으로 채운다. 이후 i18n 패스에서
  // PlayPage buildSurvivalTexts에 t('game.dodge')/t('game.miss')를 추가하면 번역이 흐른다.
  dodge?: string // 회피 성공 (§15-3)
  miss?: string // 공격 빗나감 (§15-2)
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
  // 레벨업 배분 오버레이(2b 신설, §18-1). optional — 미주입이면 ko 기본값(mergeSurvivalTexts).
  levelUpTitle?: string
  statStr?: SurvivalStatText
  statAgi?: SurvivalStatText
  statSta?: SurvivalStatText
  statPicked?: string // 배분 완료 플로팅 텍스트 접두 — 씬이 `${statPicked}: ${스탯이름}`으로 조합(blessingGained와 동일 패턴)
}

export const DEFAULT_SURVIVAL_TEXTS: SurvivalTexts = {
  instructions: '이동: 화살표 / 화면 터치(캐릭터 기준 누른 방향)   ·   무기가 자동으로 적을 구원합니다',
  redeemed: '구원됨',
  dodge: '회피!',
  miss: '빗나감',
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
  levelUpTitle: '레벨 업! 스탯을 선택해요',
  statStr: { name: '힘', desc: '공격력이 올라가요' },
  statAgi: { name: '민첩', desc: '명중과 회피 확률이 올라가요' },
  statSta: { name: '체력', desc: '최대 체력이 늘고 지금 바로 회복돼요' },
  statPicked: '스탯 선택',
}

export function mergeSurvivalTexts(partial?: Partial<SurvivalTexts>): SurvivalTexts {
  return {
    ...DEFAULT_SURVIVAL_TEXTS,
    ...partial,
    upgrades: { ...DEFAULT_SURVIVAL_TEXTS.upgrades, ...(partial?.upgrades ?? {}) },
  }
}
