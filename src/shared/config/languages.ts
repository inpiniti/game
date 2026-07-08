// 학습 언어 라벨 맵 — quiz_sets.learn_lang 표시용.
// code === null(일반 문제집)은 항상 3지선다·front→back 고정(설계 §7-3)이라 방향 시트도 생략한다.
export interface LearnLang {
  code: string
  label: string // 탭·카드 등에서 쓰는 전체 라벨 (예: '영어단어')
  short: string // 방향 선택 문구 등 짧게 써야 할 때 (예: '영어')
}

export const LEARN_LANGS: LearnLang[] = [
  { code: 'en', label: '영어단어', short: '영어' },
  { code: 'ja', label: '일본어단어', short: '일본어' },
  { code: 'zh', label: '중국어단어', short: '중국어' },
]

export const GENERAL_LABEL = '일반'

export function learnLangLabel(code: string | null): string {
  if (code === null) return GENERAL_LABEL
  return LEARN_LANGS.find((lang) => lang.code === code)?.label ?? code
}

export function learnLangShort(code: string | null): string {
  if (code === null) return GENERAL_LABEL
  return LEARN_LANGS.find((lang) => lang.code === code)?.short ?? code
}
