// ISO 3166-1 alpha-2 국가 목록 — 회원가입/프로필의 국가 선택에 사용.
// 국기 이모지 대신 국가 코드 텍스트를 쓴다 (Windows 브라우저 국기 이모지 미지원).
export interface Country {
  code: string
  /**
   * @deprecated 미사용 처리 — 화면 표시에는 countryName(code, i18n.language)를 쓰세요.
   * pages/admin-sets/AdminSetsPage.tsx(이번 작업 범위 밖)가 이 필드를 참조하므로 타입 호환을 위해 남겨두되,
   * 하드코딩 대신 Intl.DisplayNames(['ko'])로 계산한다. 극히 일부 국가(홍콩·마카오·호주·남아프리카공화국 등)는
   * CLDR 표준 표기가 과거 하드코딩 문구와 미세하게 다를 수 있다(예: "호주" → "오스트레일리아").
   */
  nameKo: string
}

export const DEFAULT_COUNTRY_CODE = 'KR'

/** 국가 코드 → 주어진 언어의 표시명 (Intl.DisplayNames). 실패하면 코드 그대로 반환. */
export function countryName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

const COUNTRY_CODES = [
  'KR', 'US', 'JP', 'CN', 'TW', 'HK', 'MO', 'GB', 'DE', 'FR',
  'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'IE', 'SE', 'NO',
  'DK', 'FI', 'PL', 'CZ', 'GR', 'RU', 'UA', 'TR', 'IN', 'ID',
  'TH', 'VN', 'PH', 'MY', 'SG', 'MN', 'KZ', 'AU', 'NZ', 'CA',
  'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'ZA', 'EG', 'SA', 'AE',
  'IL',
]

export const COUNTRIES: Country[] = COUNTRY_CODES.map((code) => ({
  code,
  nameKo: countryName(code, 'ko'),
}))

/** 검색어로 국가 목록을 필터링한다 (코드/표시명 부분 일치, 대소문자 무시). */
export function searchCountries(query: string, lang: string, countries: Country[] = COUNTRIES): Country[] {
  const trimmed = query.trim()
  if (!trimmed) return countries
  const lower = trimmed.toLowerCase()
  return countries.filter(
    (country) =>
      country.code.toLowerCase().includes(lower) ||
      countryName(country.code, lang).toLowerCase().includes(lower),
  )
}

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((country) => country.code === code)
}
