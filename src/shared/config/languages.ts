import { i18n } from '../i18n'

// 학습 언어 라벨 맵 — quiz_sets.learn_lang 표시용.
// code === null(일반 문제집)은 항상 3지선다·front→back 고정(설계 §7-3)이라 방향 시트도 생략한다.
export interface LearnLang {
  code: string
  label: string // 탭·카드 등에서 쓰는 전체 라벨 (예: '영어단어')
  short: string // 방향 선택 문구 등 짧게 써야 할 때 (예: '영어')
}

const LEARN_LANG_CODES = ['en', 'ja', 'zh'] as const

// label/short/GENERAL_LABEL은 locale 리소스에서 가져온다. 이 값들을 직접 참조하는 화면(예: pages/admin-sets/
// CountryLangFields)이 useTranslation 없이 plain 값으로 읽으므로, 여기서는 live binding(let + 재할당)으로
// 유지하고 i18n 'languageChanged' 이벤트에서 갱신한다 — 함수 시그니처를 바꾸지 않고 하위 호환을 지킨다.
function buildLearnLangs(): LearnLang[] {
  return LEARN_LANG_CODES.map((code) => ({
    code,
    label: i18n.t(`languages.${code}.label`),
    short: i18n.t(`languages.${code}.short`),
  }))
}

export let LEARN_LANGS: LearnLang[] = buildLearnLangs()
export let GENERAL_LABEL: string = i18n.t('languages.general')

i18n.on('languageChanged', () => {
  LEARN_LANGS = buildLearnLangs()
  GENERAL_LABEL = i18n.t('languages.general')
})

export function learnLangLabel(code: string | null): string {
  if (code === null) return GENERAL_LABEL
  return LEARN_LANGS.find((lang) => lang.code === code)?.label ?? code
}

export function learnLangShort(code: string | null): string {
  if (code === null) return GENERAL_LABEL
  return LEARN_LANGS.find((lang) => lang.code === code)?.short ?? code
}
