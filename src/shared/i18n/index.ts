// i18next 초기화 — main.tsx가 렌더 전에 import 한다 (부작용 모듈).
// 로케일 30종을 전부 번들에 넣으면 무거워지므로 ko(원문·폴백)만 즉시 로드하고,
// 나머지는 import.meta.glob 지연 로딩으로 언어 전환 시점에 청크를 가져온다.
// 번역 누락 키는 ko(항상 완전)로 폴백 — 번역이 베타인 동안 빈 화면 방지.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ko from './locales/ko.json'
import { isRtl, resolveInitialLang } from './resolveLang'
import type { UiLang } from './resolveLang'

// './locales/en.json' → 지연 import 함수. 새 언어는 JSON 파일만 추가하면 자동으로 잡힌다.
// ko는 위에서 정적 import(폴백·즉시 필요)하므로 지연 목록에서 제외.
const localeLoaders = import.meta.glob<{ default: Record<string, unknown> }>([
  './locales/*.json',
  '!./locales/ko.json',
])

async function loadLocale(lang: string): Promise<void> {
  if (lang === 'ko' || i18n.hasResourceBundle(lang, 'translation')) return
  const loader = localeLoaders[`./locales/${lang}.json`]
  if (!loader) return // 파일 없는 언어 — ko 폴백으로 표시된다
  const mod = await loader()
  i18n.addResourceBundle(lang, 'translation', mod.default)
}

function applyDir(lang: string): void {
  document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}

/**
 * UI 언어 전환 — 반드시 i18n.changeLanguage 대신 이 함수를 쓴다.
 * 로케일 청크를 먼저 로드한 뒤 전환하고, RTL 언어(ar·he)는 document.dir도 함께 바꾼다.
 */
export async function changeUiLang(lang: UiLang): Promise<void> {
  await loadLocale(lang)
  await i18n.changeLanguage(lang)
  applyDir(lang)
}

const initialLang = resolveInitialLang()

void i18n.use(initReactI18next).init({
  resources: { ko: { translation: ko } },
  lng: initialLang,
  fallbackLng: 'ko',
  interpolation: { escapeValue: false }, // React가 이미 XSS 이스케이프를 담당
})

// 초기 언어가 ko가 아니면 해당 번들을 비동기 로드 (로드 전 잠깐 ko로 보이는 건 감수 — 부팅 1회뿐).
applyDir(initialLang)
if (initialLang !== 'ko') {
  void loadLocale(initialLang).then(() => i18n.changeLanguage(initialLang))
}

export { i18n }
export {
  SUPPORTED_LANGS,
  LANG_LABELS,
  RTL_LANGS,
  UI_LANG_STORAGE_KEY,
  isRtl,
  isUiLang,
  readStoredLang,
  saveStoredLang,
  langFromCountry,
  langFromBrowser,
  resolveInitialLang,
} from './resolveLang'
export type { UiLang } from './resolveLang'
