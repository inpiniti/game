import { useEffect, useState } from 'react'
import { useUpdateQuizSet, type QuizSetWithCount } from '../../entities/quiz-set'
import { DEFAULT_COUNTRY_CODE } from '../../shared/config/countries'
import { BottomSheet } from '../../shared/ui/bottom-sheet/BottomSheet'
import form from '../../shared/ui/form.module.css'
import { CountryLangFields, type CountryMode } from './CountryLangFields'
import styles from './AdminSetsPage.module.css'

interface PromoteSetSheetProps {
  /** null이면 시트가 닫힌다 — 승격할 개인 문제집이 열려 있는 동안만 값이 채워진다. */
  set: QuizSetWithCount | null
  onClose: () => void
}

// admin/sets §(b) [개인 문제집 승격] 탭 — [승격] → 국가·언어 지정 → quiz_sets update
// { is_official:true, country, learn_lang }. RLS "admin manages sets"가 개인 소유 행에도 이 조합을 허용한다.
export function PromoteSetSheet({ set, onClose }: PromoteSetSheetProps) {
  const updateSet = useUpdateQuizSet()
  const [countryMode, setCountryMode] = useState<CountryMode>('specific')
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE)
  const [learnLang, setLearnLang] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!set) return
    setCountryMode('specific')
    setCountry(DEFAULT_COUNTRY_CODE)
    setLearnLang(set.learn_lang)
    setErrorMessage(null)
  }, [set])

  const handlePromote = async () => {
    if (!set) return
    try {
      await updateSet.mutateAsync({
        id: set.id,
        isOfficial: true,
        country: countryMode === 'common' ? null : country,
        learnLang,
      })
      onClose()
    } catch {
      setErrorMessage('승격하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <BottomSheet open={!!set} onClose={onClose} title="공식 문제집으로 승격">
      {set && (
        <p className={styles.promoteNotice}>
          <strong>{set.title}</strong>을(를) 지정한 국가의 모든 유저가 플레이할 수 있는 공식 문제집으로 만들어요.
        </p>
      )}

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
        onClick={handlePromote}
        disabled={updateSet.isPending}
        aria-busy={updateSet.isPending}
      >
        {updateSet.isPending ? '승격하고 있어요…' : '승격하기'}
      </button>
    </BottomSheet>
  )
}
