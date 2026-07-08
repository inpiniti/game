// ISO 3166-1 alpha-2 국가 목록 — 회원가입/프로필의 국가 선택에 사용.
// 국기 이모지 대신 국가 코드 텍스트를 쓴다 (Windows 브라우저 국기 이모지 미지원).
export interface Country {
  code: string
  nameKo: string
}

export const DEFAULT_COUNTRY_CODE = 'KR'

export const COUNTRIES: Country[] = [
  { code: 'KR', nameKo: '대한민국' },
  { code: 'US', nameKo: '미국' },
  { code: 'JP', nameKo: '일본' },
  { code: 'CN', nameKo: '중국' },
  { code: 'TW', nameKo: '대만' },
  { code: 'HK', nameKo: '홍콩' },
  { code: 'MO', nameKo: '마카오' },
  { code: 'GB', nameKo: '영국' },
  { code: 'DE', nameKo: '독일' },
  { code: 'FR', nameKo: '프랑스' },
  { code: 'IT', nameKo: '이탈리아' },
  { code: 'ES', nameKo: '스페인' },
  { code: 'PT', nameKo: '포르투갈' },
  { code: 'NL', nameKo: '네덜란드' },
  { code: 'BE', nameKo: '벨기에' },
  { code: 'CH', nameKo: '스위스' },
  { code: 'AT', nameKo: '오스트리아' },
  { code: 'IE', nameKo: '아일랜드' },
  { code: 'SE', nameKo: '스웨덴' },
  { code: 'NO', nameKo: '노르웨이' },
  { code: 'DK', nameKo: '덴마크' },
  { code: 'FI', nameKo: '핀란드' },
  { code: 'PL', nameKo: '폴란드' },
  { code: 'CZ', nameKo: '체코' },
  { code: 'GR', nameKo: '그리스' },
  { code: 'RU', nameKo: '러시아' },
  { code: 'UA', nameKo: '우크라이나' },
  { code: 'TR', nameKo: '튀르키예' },
  { code: 'IN', nameKo: '인도' },
  { code: 'ID', nameKo: '인도네시아' },
  { code: 'TH', nameKo: '태국' },
  { code: 'VN', nameKo: '베트남' },
  { code: 'PH', nameKo: '필리핀' },
  { code: 'MY', nameKo: '말레이시아' },
  { code: 'SG', nameKo: '싱가포르' },
  { code: 'MN', nameKo: '몽골' },
  { code: 'KZ', nameKo: '카자흐스탄' },
  { code: 'AU', nameKo: '호주' },
  { code: 'NZ', nameKo: '뉴질랜드' },
  { code: 'CA', nameKo: '캐나다' },
  { code: 'MX', nameKo: '멕시코' },
  { code: 'BR', nameKo: '브라질' },
  { code: 'AR', nameKo: '아르헨티나' },
  { code: 'CL', nameKo: '칠레' },
  { code: 'CO', nameKo: '콜롬비아' },
  { code: 'PE', nameKo: '페루' },
  { code: 'ZA', nameKo: '남아프리카공화국' },
  { code: 'EG', nameKo: '이집트' },
  { code: 'SA', nameKo: '사우디아라비아' },
  { code: 'AE', nameKo: '아랍에미리트' },
  { code: 'IL', nameKo: '이스라엘' },
]

/** 검색어로 국가 목록을 필터링한다 (코드/국문명 부분 일치, 대소문자 무시). */
export function searchCountries(query: string, countries: Country[] = COUNTRIES): Country[] {
  const trimmed = query.trim()
  if (!trimmed) return countries
  const lower = trimmed.toLowerCase()
  return countries.filter(
    (country) => country.code.toLowerCase().includes(lower) || country.nameKo.includes(trimmed),
  )
}

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((country) => country.code === code)
}
