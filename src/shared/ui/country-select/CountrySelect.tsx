import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COUNTRIES, countryName, findCountry, searchCountries } from '../../config/countries'
import { BottomSheet } from '../bottom-sheet/BottomSheet'
import styles from './CountrySelect.module.css'

interface CountrySelectProps {
  value: string
  onChange: (code: string) => void
}

// 읽기 전용 선택 박스 → 탭 → 바텀시트(검색+단일 선택) → 선택 즉시 닫힘. 국기 이모지 대신 코드 텍스트.
export function CountrySelect({ value, onChange }: CountrySelectProps) {
  const { t, i18n: i18nInstance } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = findCountry(value)
  const results = useMemo(
    () => searchCountries(query, i18nInstance.language, COUNTRIES),
    [query, i18nInstance.language],
  )

  const handleSelect = (code: string) => {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <span>
          {selected ? `${selected.code} · ${countryName(selected.code, i18nInstance.language)}` : t('countrySelect.placeholder')}
        </span>
        <span className={styles.chevron} aria-hidden>
          ›
        </span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('countrySelect.title')}>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('countrySelect.searchPlaceholder')}
          className={styles.search}
          autoFocus
        />
        <ul className={styles.list}>
          {results.map((country) => (
            <li key={country.code}>
              <button type="button" className={styles.option} onClick={() => handleSelect(country.code)}>
                <span>
                  {country.code} · {countryName(country.code, i18nInstance.language)}
                </span>
                {country.code === value && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className={styles.empty}>{t('countrySelect.empty')}</li>}
        </ul>
      </BottomSheet>
    </>
  )
}
