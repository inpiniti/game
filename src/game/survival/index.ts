import Phaser from 'phaser'
import SurvivalScene from './SurvivalScene'
import { mergeSurvivalTexts } from './texts'
import type { SurvivalTexts } from './texts'

export type { SurvivalTexts, SurvivalUpgradeText } from './texts'
export { DEFAULT_SURVIVAL_TEXTS } from './texts'

// 성장 계산은 shared/lib/growth(단일 소스)에 있다. 앱↔게임 계약 소비자(PlayPage 등)가
// 이 계약 모듈 한 곳에서 성장 상수·공식을 함께 가져갈 수 있도록 재-export 한다(텍스트 재-export와 동일 패턴).
// 씬(SurvivalScene.js)은 growth 를 shared/lib 에서 "직접" import 하므로 단일 권위는 growth 가 유지한다.
export {
  EXP_BY_TIER,
  POINTS_PER_LEVEL,
  CONTACT_DAMAGE,
  IFRAME_MS,
  expToNext,
  expForKills,
  levelForExp,
  dmgMul,
  hitChance,
  dodgeChance,
  maxHp,
} from '../../shared/lib/growth'
export type { LevelProgress, KillsByTier } from '../../shared/lib/growth'

// 영구 성장 스탯 (설계 v10 §17-1). 판 시작 시 주입되고, DB(user_stats)와 1:1 대응한다.
export interface PlayerStats {
  level: number
  exp: number // 누적 경험치 총량
  str: number
  agi: number
  sta: number
  unspent: number // 미배분 포인트
}

// 미주입 시(단독 실행·신규) 기본값 — 레벨1, 경험치·스탯·미배분 전부 0.
export const DEFAULT_PLAYER_STATS: PlayerStats = {
  level: 1,
  exp: 0,
  str: 0,
  agi: 0,
  sta: 0,
  unspent: 0,
}

// 씬이 소비하는 브리지 (덕타이핑). 게임은 FSD/Supabase를 모르므로
// 앱 쪽 계약(features/play-quiz)을 import 하지 않고 최소 형태만 로컬 선언한다.
export interface SurvivalGameOver {
  score: number
  kills: number
  seconds: number
  reason: 'death' | 'quit'
  // ★ 서버 경험치 계산용 — 티어별 처치 수 (§17-2). exp_gain 은 서버가 이 값으로 재계산.
  killsByTier: { weak: number; mid: number; strong: number }
  // ★ 이번 판에 배분한 스탯 델타 (§17-2). 서버가 예산(unspent)으로 캡 검증.
  allocations: { str: number; agi: number; sta: number }
}

export interface SurvivalBridge {
  requestQuiz(): Promise<{ correct: boolean }>
  onGameOver(result: SurvivalGameOver): void
}

// React(pages/play)에서 호출하는 Phaser 게임 팩토리.
// parent 는 캔버스를 담을 DOM 요소. RESIZE 모드로 그 요소를 꽉 채운다.
// bridge/texts 는 registry 로 씬에 주입된다(SurvivalScene.create 에서 꺼내 씀).
// texts 는 번역된 게임 문자열 사전 — 옵셔널, 미주입 시 ko 기본값(texts.ts).
// initialStats 는 현재 스탯(useUserStats 로 로드) — 옵셔널, 미주입 시 DEFAULT_PLAYER_STATS.
// registry 로 씬에 주입되며, 씬이 이를 소비하는 전투 로직은 2단계다(여기선 주입까지만).
export function createSurvivalGame(
  parent: HTMLElement,
  bridge: SurvivalBridge,
  texts?: Partial<SurvivalTexts>,
  initialStats?: PlayerStats,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#4e7d33',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || window.innerWidth,
      height: parent.clientHeight || window.innerHeight,
    },
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [SurvivalScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set('quizBridge', bridge)
        game.registry.set('texts', mergeSurvivalTexts(texts))
        game.registry.set('stats', initialStats ?? DEFAULT_PLAYER_STATS)
      },
    },
  })
}
