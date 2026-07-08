export interface QuizItem {
  id: string
  quiz_set_id: string
  position: number
  front: string // 단어장: 학습 언어 단어 / 일반: 문제
  back: string // 단어장: 모국어 뜻 / 일반: 답 (';' 복수 표기)
  example: string | null
}
