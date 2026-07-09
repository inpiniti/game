import { i18n } from '../i18n'

// 문제집 대상(카테고리) 코드 — quiz_sets.category 표시용.
// 순서 = 초등/중등/고등/일반인(설계 §2-1). null = 미분류.
export interface Category {
  code: CategoryCode
  label: string // 칩·필터·폼 등에서 쓰는 라벨 (예: '초등')
}

export const CATEGORY_CODES = ['elementary', 'middle', 'high', 'general'] as const
export type CategoryCode = (typeof CATEGORY_CODES)[number]

// label은 locale 리소스에서 가져온다. languages.ts와 동일하게 live binding(let + 재할당)으로 유지하고
// i18n 'languageChanged' 이벤트에서 갱신한다 — 함수 시그니처를 바꾸지 않고 하위 호환을 지킨다.
function buildCategories(): Category[] {
  return CATEGORY_CODES.map((code) => ({
    code,
    label: i18n.t(`categories.${code}`),
  }))
}

export let CATEGORIES: Category[] = buildCategories()

i18n.on('languageChanged', () => {
  CATEGORIES = buildCategories()
})

export function categoryLabel(code: CategoryCode | null): string {
  if (code === null) return ''
  return CATEGORIES.find((category) => category.code === code)?.label ?? code
}
