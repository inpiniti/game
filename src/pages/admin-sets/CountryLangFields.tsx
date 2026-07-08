import { LEARN_LANGS, GENERAL_LABEL } from '../../shared/config/languages'
import { CountrySelect } from '../../shared/ui/country-select/CountrySelect'
import form from '../../shared/ui/form.module.css'
import styles from './AdminSetsPage.module.css'

export type CountryMode = 'common' | 'specific'

interface CountryLangFieldsProps {
  countryMode: CountryMode
  onCountryModeChange: (mode: CountryMode) => void
  country: string
  onCountryChange: (code: string) => void
  learnLang: string | null
  onLearnLangChange: (code: string | null) => void
}

// 공식 문제집 수정(EditSetSheet)·개인→공식 승격(PromoteSetSheet)이 함께 쓰는 국가·언어 입력 필드.
// 국가는 CountrySelect가 null을 표현하지 못하므로 "공통(전체 국가)" ↔ "국가 지정" 토글로 country: null 여부를 먼저 고르고,
// 지정일 때만 CountrySelect를 보여준다(docs/sql/01-init.sql: country null = 전체 공통).
export function CountryLangFields({
  countryMode,
  onCountryModeChange,
  country,
  onCountryChange,
  learnLang,
  onLearnLangChange,
}: CountryLangFieldsProps) {
  return (
    <>
      <div className={form.field}>
        <span className={form.label}>국가</span>
        <div className={styles.chipRow}>
          <button
            type="button"
            className={countryMode === 'common' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            onClick={() => onCountryModeChange('common')}
          >
            공통(전체 국가)
          </button>
          <button
            type="button"
            className={countryMode === 'specific' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            onClick={() => onCountryModeChange('specific')}
          >
            국가 지정
          </button>
        </div>
        {countryMode === 'specific' && (
          <div className={styles.countrySelectWrap}>
            <CountrySelect value={country} onChange={onCountryChange} />
          </div>
        )}
      </div>

      <div className={form.field}>
        <span className={form.label}>언어</span>
        <div className={styles.chipRow}>
          {LEARN_LANGS.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={learnLang === lang.code ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => onLearnLangChange(lang.code)}
            >
              {lang.label}
            </button>
          ))}
          <button
            type="button"
            className={learnLang === null ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            onClick={() => onLearnLangChange(null)}
          >
            {GENERAL_LABEL}
          </button>
        </div>
      </div>
    </>
  )
}
