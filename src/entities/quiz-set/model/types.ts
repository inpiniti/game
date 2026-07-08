export interface QuizSet {
  id: string
  title: string
  user_id: string | null
  is_official: boolean
  country: string | null
  learn_lang: string | null // 'en'/'ja'/'zh'... = 단어장, null = 일반 문제/답
  created_at: string
}

// 목록(useQuizSets)용 — 카드에 "단어 N개"를 보여주려면 quiz_items count가 필요하다.
export interface QuizSetWithCount extends QuizSet {
  itemCount: number
}
