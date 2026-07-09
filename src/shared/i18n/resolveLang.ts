// UI 언어 결정 정책 (설계 v9 13-2, features/2026-07-08_i18n.md 2-1)
// 우선순위: 명시 선택(localStorage) → 국가 매핑 → 브라우저 언어 → en 폴백.
// 국가 매핑은 로그인 후에만 가능하므로 app/LangSync.tsx가 프로필 로드 시점에 적용한다.
// 주의: 국가(country)는 랭킹용, 학습 언어(learn_lang)는 문제집용 — UI 언어와 별개 개념.

// 지원 언어 — shared/config/countries.ts의 51개국 전체를 커버한다.
// 언어 추가 = locales/<lang>.json 추가 + 이 배열/라벨/국가 매핑 한 줄씩.
export const SUPPORTED_LANGS = [
  'ko', 'en', 'ja', 'zh-CN', 'zh-TW',
  'de', 'fr', 'it', 'es', 'pt',
  'nl', 'sv', 'no', 'da', 'fi',
  'pl', 'cs', 'el', 'ru', 'uk',
  'tr', 'hi', 'id', 'th', 'vi',
  'ms', 'mn', 'kk', 'ar', 'he',
] as const
export type UiLang = (typeof SUPPORTED_LANGS)[number]

export const UI_LANG_STORAGE_KEY = 'ddalki.ui-lang'

// RTL 언어 — index.ts의 changeUiLang이 document.dir을 전환한다 (베스트에포트 베타).
export const RTL_LANGS: readonly UiLang[] = ['ar', 'he']

export function isRtl(lang: string): boolean {
  return (RTL_LANGS as readonly string[]).includes(lang)
}

// 언어 이름은 그 언어 자신으로 표기 — 어떤 언어 상태에서도 자기 언어를 찾을 수 있게 (번역하지 않는다).
export const LANG_LABELS: Record<UiLang, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
  pt: 'Português',
  nl: 'Nederlands',
  sv: 'Svenska',
  no: 'Norsk',
  da: 'Dansk',
  fi: 'Suomi',
  pl: 'Polski',
  cs: 'Čeština',
  el: 'Ελληνικά',
  ru: 'Русский',
  uk: 'Українська',
  tr: 'Türkçe',
  hi: 'हिन्दी',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  ms: 'Bahasa Melayu',
  mn: 'Монгол',
  kk: 'Қазақша',
  ar: 'العربية',
  he: 'עברית',
}

export function isUiLang(value: unknown): value is UiLang {
  return typeof value === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(value)
}

export function readStoredLang(): UiLang | null {
  try {
    const stored = localStorage.getItem(UI_LANG_STORAGE_KEY)
    return isUiLang(stored) ? stored : null
  } catch {
    return null // localStorage 접근 불가 환경(프라이빗 모드 등)은 명시 선택 없음으로 취급
  }
}

export function saveStoredLang(lang: UiLang): void {
  try {
    localStorage.setItem(UI_LANG_STORAGE_KEY, lang)
  } catch {
    // 저장 실패 시 이번 세션만 적용 (changeLanguage는 이미 반영됨)
  }
}

// 국가 → UI 언어 기본값 (shared/config/countries.ts의 51개국 전체).
// 다국어 국가는 최다 사용 언어 기준: BE→nl, CH→de, ZA/PH/SG→en, KZ→kk.
// 목록에 없는 국가(향후 추가분)는 en.
const COUNTRY_TO_LANG: Record<string, UiLang> = {
  KR: 'ko',
  JP: 'ja',
  US: 'en', GB: 'en', IE: 'en', AU: 'en', NZ: 'en', CA: 'en', SG: 'en', PH: 'en', ZA: 'en',
  CN: 'zh-CN',
  TW: 'zh-TW', HK: 'zh-TW', MO: 'zh-TW',
  DE: 'de', AT: 'de', CH: 'de',
  FR: 'fr',
  IT: 'it',
  ES: 'es', MX: 'es', AR: 'es', CL: 'es', CO: 'es', PE: 'es',
  PT: 'pt', BR: 'pt',
  NL: 'nl', BE: 'nl',
  SE: 'sv',
  NO: 'no',
  DK: 'da',
  FI: 'fi',
  PL: 'pl',
  CZ: 'cs',
  GR: 'el',
  RU: 'ru',
  UA: 'uk',
  TR: 'tr',
  IN: 'hi',
  ID: 'id',
  TH: 'th',
  VN: 'vi',
  MY: 'ms',
  MN: 'mn',
  KZ: 'kk',
  EG: 'ar', SA: 'ar', AE: 'ar',
  IL: 'he',
}

export function langFromCountry(country: string | null | undefined): UiLang | null {
  if (!country) return null
  return COUNTRY_TO_LANG[country] ?? 'en'
}

export function langFromBrowser(): UiLang | null {
  const raw = typeof navigator !== 'undefined' ? navigator.language : ''
  if (!raw) return null
  // 중국어는 지역/문자에 따라 간체·번체로 갈린다: TW/HK/MO/Hant → 번체, 그 외 → 간체
  if (raw.toLowerCase().startsWith('zh')) {
    return /tw|hk|mo|hant/i.test(raw) ? 'zh-TW' : 'zh-CN'
  }
  if (isUiLang(raw)) return raw // 'zh-CN' 같은 전체 태그 일치
  const base = raw.toLowerCase().split('-')[0] // 'pt-BR' → 'pt'
  return isUiLang(base) ? base : null
}

// 앱 부팅 시점의 언어 — 국가는 아직 모르므로 저장값 → 브라우저 → en.
// 로그인 후 국가 매핑 반영은 LangSync 담당 (명시 선택이 있으면 건드리지 않는다).
export function resolveInitialLang(): UiLang {
  return readStoredLang() ?? langFromBrowser() ?? 'en'
}
