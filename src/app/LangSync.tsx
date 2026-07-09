import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '../entities/user'
import { changeUiLang, langFromCountry, readStoredLang } from '../shared/i18n'

// 명시 선택(localStorage)이 없으면 로그인 유저의 국가로 UI 언어를 맞춘다 (설계 v9 13-2).
// 명시 선택이 항상 이긴다 — 국가는 기본값 힌트일 뿐 (국가 ≠ UI 언어).
export function LangSync() {
  const { i18n } = useTranslation()
  const { profile } = useCurrentUser()
  const country = profile?.country

  useEffect(() => {
    if (readStoredLang()) return
    const lang = langFromCountry(country)
    if (lang && lang !== i18n.language) void changeUiLang(lang) // 로케일 청크 로드 + dir 전환 포함
  }, [country, i18n])

  return null
}
