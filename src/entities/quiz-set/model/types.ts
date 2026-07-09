import type { CategoryCode } from '../../../shared/config/categories'

export interface QuizSet {
  id: string
  title: string
  user_id: string | null
  is_official: boolean
  country: string | null
  learn_lang: string | null // 'en'/'ja'/'zh'... = 단어장, null = 일반 문제/답
  category: CategoryCode | null // 대상(초등/중등/고등/일반인), null = 미분류
  created_at: string
}

// 목록(useQuizSets)용 — 카드에 "단어 N개"를 보여주려면 quiz_items count가 필요하다.
export interface QuizSetWithCount extends QuizSet {
  itemCount: number
}
