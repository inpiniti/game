import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { LEARN_LANGS, GENERAL_LABEL } from '../../../shared/config/languages'
import { DEFAULT_COUNTRY_CODE } from '../../../shared/config/countries'
import { CountrySelect } from '../../../shared/ui/country-select/CountrySelect'
import { parseQuizCsv, parseQuizJson } from '../../../shared/lib/quizParser'
import form from '../../../shared/ui/form.module.css'
import { useUploadQuizSet } from '../model/useUploadQuizSet'
import styles from './UploadQuizSetForm.module.css'

type Format = 'csv' | 'json'

interface UploadQuizSetFormProps {
  userId: string
  onSuccess: (newSetId: string) => void
  /**
   * true면 관리자 공식 업로드 모드 — 국가(CountrySelect) 행이 추가되고, 제출 시 quiz_sets에
   * is_official:true + 선택한 country를 함께 넣는다(RLS "admin manages sets" 근거). 기본은 개인 업로드.
   */
  official?: boolean
}

const CSV_PLACEHOLDER = `front,back,example
apple,사과,I ate an apple.
run,달리다;뛰다,`

const JSON_PLACEHOLDER = `[
  { "front": "apple", "back": "사과", "example": "I ate an apple." },
  { "front": "run", "back": "달리다;뛰다" }
]`

// 문제집 업로드 폼 — 제목 + (official 모드면 국가) + 언어 + CSV/JSON 붙여넣기(또는 파일) +
// 실시간 미리보기·행 단위 오류. 오류가 하나라도 있으면 제출을 막는다(부분 저장으로 인한 혼란 방지).
// 개인 업로드(QuizSetListPage)와 관리자 공식 업로드(admin-upload/AdminUploadPage)가 이 폼 하나를 공유한다.
export function UploadQuizSetForm({ userId, onSuccess, official = false }: UploadQuizSetFormProps) {
  const [title, setTitle] = useState('')
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE)
  const [learnLang, setLearnLang] = useState<string | null>(LEARN_LANGS[0]?.code ?? null)
  const [format, setFormat] = useState<Format>('csv')
  const [text, setText] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadQuizSet()

  const parsed = useMemo(() => (format === 'csv' ? parseQuizCsv(text) : parseQuizJson(text)), [text, format])

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText(content)
    const name = file.name.toLowerCase()
    if (name.endsWith('.json')) setFormat('json')
    else if (name.endsWith('.csv')) setFormat('csv')
    else setFormat(content.trim().startsWith('[') ? 'json' : 'csv')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const canSubmit =
    title.trim().length > 0 && parsed.validCount > 0 && parsed.errorCount === 0 && !upload.isPending

  const handleSubmit = async () => {
    setErrorMessage(null)
    if (!title.trim()) {
      setErrorMessage('제목을 입력하면 업로드할 수 있어요.')
      return
    }
    if (parsed.errorCount > 0) {
      setErrorMessage('오류가 있는 행을 모두 고치면 업로드할 수 있어요.')
      return
    }
    if (parsed.validCount === 0) {
      setErrorMessage('단어를 1개 이상 입력하면 업로드할 수 있어요.')
      return
    }
    try {
      const newSetId = await upload.submit({
        title: title.trim(),
        learnLang,
        userId,
        rows: parsed.rows,
        ...(official ? { isOfficial: true, country } : {}),
      })
      onSuccess(newSetId)
    } catch {
      setErrorMessage('업로드하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <div className={styles.form}>
      <label className={form.field}>
        <span className={form.label}>제목</span>
        <input
          type="text"
          className={form.input}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: 중1 영단어"
          maxLength={60}
        />
      </label>

      {official && (
        <div className={form.field}>
          <span className={form.label}>국가</span>
          <CountrySelect value={country} onChange={setCountry} />
        </div>
      )}

      <div className={form.field}>
        <span className={form.label}>언어</span>
        <div className={styles.chipRow}>
          {LEARN_LANGS.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={learnLang === lang.code ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => setLearnLang(lang.code)}
            >
              {lang.label}
            </button>
          ))}
          <button
            type="button"
            className={learnLang === null ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            onClick={() => setLearnLang(null)}
          >
            {GENERAL_LABEL}
          </button>
        </div>
      </div>

      <div className={form.field}>
        <div className={styles.formatRow}>
          <span className={form.label}>단어 입력</span>
          <div className={styles.formatToggle}>
            <button
              type="button"
              className={format === 'csv' ? `${styles.formatButton} ${styles.formatActive}` : styles.formatButton}
              onClick={() => setFormat('csv')}
            >
              CSV
            </button>
            <button
              type="button"
              className={format === 'json' ? `${styles.formatButton} ${styles.formatActive}` : styles.formatButton}
              onClick={() => setFormat('json')}
            >
              JSON
            </button>
          </div>
        </div>

        <textarea
          className={styles.textarea}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={format === 'csv' ? CSV_PLACEHOLDER : JSON_PLACEHOLDER}
          rows={8}
          spellCheck={false}
        />

        <div className={styles.fileRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={handleFileChange}
            className={styles.fileInput}
            id="quiz-upload-file"
          />
          <label htmlFor="quiz-upload-file" className={styles.fileLabel}>
            파일에서 불러오기
          </label>
        </div>
      </div>

      {text.trim().length > 0 && (
        <div className={styles.preview}>
          <p className={styles.previewSummary}>
            미리보기 · 정상 {parsed.validCount}행
            {parsed.errorCount > 0 && <span className={styles.previewError}> · 오류 {parsed.errorCount}행</span>}
          </p>
          <div className={styles.previewTableWrap}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>front</th>
                  <th>back</th>
                  <th>example</th>
                  <th>확인</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row) => (
                  <tr key={row.row} className={row.error ? styles.previewRowError : undefined}>
                    <td>{row.row}</td>
                    <td>{row.front || '—'}</td>
                    <td>{row.back || '—'}</td>
                    <td>{row.example ?? ''}</td>
                    <td className={row.error ? styles.previewErrorCell : styles.previewOkCell}>
                      {row.error ?? '정상'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {errorMessage && <p className={form.error}>{errorMessage}</p>}

      <button
        type="button"
        className={form.primaryButton}
        disabled={!canSubmit}
        aria-busy={upload.isPending}
        onClick={handleSubmit}
      >
        {upload.isPending ? '업로드하고 있어요…' : '업로드하기'}
      </button>
    </div>
  )
}
