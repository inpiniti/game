import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdateQuizSet, type QuizSetWithCount } from '../../entities/quiz-set'
import { DEFAULT_COUNTRY_CODE } from '../../shared/config/countries'
import type { CategoryCode } from '../../shared/config/categories'
import { BottomSheet } from '../../shared/ui/bottom-sheet/BottomSheet'
import form from '../../shared/ui/form.module.css'
import { CountryLangFields, type CountryMode } from './CountryLangFields'

interface EditSetSheetProps {
  /** null이면 시트가 닫힌다 — 수정할 공식 문제집이 열려 있는 동안만 값이 채워진다. */
  set: QuizSetWithCount | null
  onClose: () => void
}

// admin/sets §(b) [수정] — 공식 문제집의 제목·국가·언어를 편집한다. RLS "admin manages sets"가 근거.
export function EditSetSheet({ set, onClose }: EditSetSheetProps) {
  const { t } = useTranslation()
  const updateSet = useUpdateQuizSet()
  const [title, setTitle] = useState('')
  const [countryMode, setCountryMode] = useState<CountryMode>('common')
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE)
  const [learnLang, setLearnLang] = useState<string | null>(null)
  const [category, setCategory] = useState<CategoryCode | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!set) return
    setTitle(set.title)
    setCountryMode(set.country ? 'specific' : 'common')
    setCountry(set.country ?? DEFAULT_COUNTRY_CODE)
    setLearnLang(set.learn_lang)
    setCategory(set.category)
    setErrorMessage(null)
  }, [set])

  const handleSave = async () => {
    if (!set) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setErrorMessage(t('adminSets.titleRequiredError'))
      return
    }
    try {
      await updateSet.mutateAsync({
        id: set.id,
        title: trimmedTitle,
        country: countryMode === 'common' ? null : country,
        learnLang,
        category,
      })
      onClose()
    } catch {
      setErrorMessage(t('common.saveError'))
    }
  }

  return (
    <BottomSheet open={!!set} onClose={onClose} title={t('adminSets.editSheetTitle')}>
      <label className={form.field}>
        <span className={form.label}>{t('adminSets.titleFieldLabel')}</span>
        <input
          type="text"
          className={form.input}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={60}
        />
      </label>

      <CountryLangFields
        countryMode={countryMode}
        onCountryModeChange={setCountryMode}
        country={country}
        onCountryChange={setCountry}
        learnLang={learnLang}
        onLearnLangChange={setLearnLang}
        category={category}
        onCategoryChange={setCategory}
      />

      {errorMessage && <p className={form.error}>{errorMessage}</p>}

      <button
        type="button"
        className={form.primaryButton}
        onClick={handleSave}
        disabled={updateSet.isPending}
        aria-busy={updateSet.isPending}
      >
        {updateSet.isPending ? t('common.saving') : t('common.save')}
      </button>
    </BottomSheet>
  )
}
