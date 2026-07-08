import { useEffect, useState } from 'react'
import { useUpdateQuizSet, type QuizSetWithCount } from '../../entities/quiz-set'
import { DEFAULT_COUNTRY_CODE } from '../../shared/config/countries'
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
  const updateSet = useUpdateQuizSet()
  const [title, setTitle] = useState('')
  const [countryMode, setCountryMode] = useState<CountryMode>('common')
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE)
  const [learnLang, setLearnLang] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!set) return
    setTitle(set.title)
    setCountryMode(set.country ? 'specific' : 'common')
    setCountry(set.country ?? DEFAULT_COUNTRY_CODE)
    setLearnLang(set.learn_lang)
    setErrorMessage(null)
  }, [set])

  const handleSave = async () => {
    if (!set) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setErrorMessage('제목을 입력하면 저장할 수 있어요.')
      return
    }
    try {
      await updateSet.mutateAsync({
        id: set.id,
        title: trimmedTitle,
        country: countryMode === 'common' ? null : country,
        learnLang,
      })
      onClose()
    } catch {
      setErrorMessage('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <BottomSheet open={!!set} onClose={onClose} title="공식 문제집 수정">
      <label className={form.field}>
        <span className={form.label}>제목</span>
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
      />

      {errorMessage && <p className={form.error}>{errorMessage}</p>}

      <button
        type="button"
        className={form.primaryButton}
        onClick={handleSave}
        disabled={updateSet.isPending}
        aria-busy={updateSet.isPending}
      >
        {updateSet.isPending ? '저장하고 있어요…' : '저장하기'}
      </button>
    </BottomSheet>
  )
}
