import Phaser from 'phaser'
import SurvivalScene from './SurvivalScene'

// 씬이 소비하는 브리지 (덕타이핑). 게임은 FSD/Supabase를 모르므로
// 앱 쪽 계약(features/play-quiz)을 import 하지 않고 최소 형태만 로컬 선언한다.
export interface SurvivalGameOver {
  score: number
  kills: number
  seconds: number
  reason: 'death' | 'quit'
}

export interface SurvivalBridge {
  requestQuiz(): Promise<{ correct: boolean }>
  onGameOver(result: SurvivalGameOver): void
}

// React(pages/play)에서 호출하는 Phaser 게임 팩토리.
// parent 는 캔버스를 담을 DOM 요소. RESIZE 모드로 그 요소를 꽉 채운다.
// bridge 는 registry 로 씬에 주입된다(SurvivalScene.create 에서 꺼내 씀).
export function createSurvivalGame(parent: HTMLElement, bridge: SurvivalBridge): Phaser.Game {
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
      },
    },
  })
}
