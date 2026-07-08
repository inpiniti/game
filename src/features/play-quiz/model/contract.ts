// 게임 ↔ 앱 계약 (설계 §7-4). 순수 타입만 — Supabase/DOM 의존 없음.
// 게임(src/game)은 이 파일을 import 하지 않고 덕타이핑으로 브리지를 소비한다.

export interface QuizQuestion {
  itemId: string
  prompt: string // 방향에 따른 대표 표기
  mode: 'choice' | 'input' // 엔진이 카드 상태로 자동 결정 (단계 3은 choice만)
  choices: string[] // choice 모드
  correctIndices: number[] // 복수 정답 인덱스 (어느 것을 골라도 정답)
  answers: string[] // 정답 변형 목록 (input 모드 채점·입력창 수)
  example?: string
}

export interface AnswerLog {
  itemId: string
  given: string
  correct: boolean
}

export interface GameResult {
  score: number
  kills: number
  answers: AnswerLog[]
}

// 오버레이가 소비하는 출제원. 단계 7에서 SRS 기반 구현으로 교체.
export interface QuizSource {
  next(): QuizQuestion | null
  report(log: AnswerLog): void
}

// 씬이 소비하는 브리지 (Promise 기반). 씬은 requestQuiz()를 await 하고
// 정답 여부만 받는다 — 어떤 업그레이드를 줄지는 씬이 결정한다.
export interface QuizBridge {
  requestQuiz(): Promise<{ correct: boolean }>
  onGameOver(result: GameResult): void // 단계 4에서 사용
}
