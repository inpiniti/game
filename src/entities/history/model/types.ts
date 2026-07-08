// docs/sql/01-init.sql `play_histories` 테이블과 대응 — 한 판 단위 불변 기록.
// 결과 화면(pages/result)이 즉석 요약을 쓰는 것과 별개로, 기록 화면(단계 후속)에서 이 타입을 재사용한다.
export interface WrongItem {
  item_id: string
  given: string
}

export interface PlaySettings {
  direction: 'front-back' | 'back-front'
  answerMode?: 'choice' | 'input'
  choiceCount?: number
}

export interface PlayHistory {
  id: string
  user_id: string
  quiz_set_id: string | null
  game_type: 'survival'
  settings: PlaySettings
  score: number
  correct_count: number
  total_count: number
  wrong_items: WrongItem[]
  played_at: string
}

// usePlayHistories()용 — quiz_sets(title) 조인 결과. 문제집이 삭제됐으면(quiz_set_id null) setTitle도 null.
export interface PlayHistoryWithSet extends PlayHistory {
  setTitle: string | null
}
