import { useCreateQuizSet } from '../../../entities/quiz-set'
import { useUpsertQuizItems } from '../../../entities/quiz-item'
import type { ParsedQuizRow } from '../../../shared/lib/quizParser'

export interface UploadQuizSetInput {
  title: string
  learnLang: string | null
  userId: string
  /** 오류 없는(row.error === null) 행만 넘겨야 한다 — 검증은 호출부(UploadQuizSetForm)가 미리 마친다. */
  rows: ParsedQuizRow[]
  /** 관리자 공식 업로드(UploadQuizSetForm의 official 모드)에서만 true + country를 함께 넘긴다. */
  isOfficial?: boolean
  country?: string | null
}

// 업로드 폼 제출 1회 = quiz_sets insert + quiz_items bulk insert.
// 신규 행이라 upsert 대상 id를 여기서 crypto.randomUUID()로 생성한다(entities/quiz-item의 upsert 계약).
export function useUploadQuizSet() {
  const createSet = useCreateQuizSet()
  const upsertItems = useUpsertQuizItems()

  async function submit(input: UploadQuizSetInput): Promise<string> {
    const setId = await createSet.mutateAsync({
      title: input.title,
      learnLang: input.learnLang,
      userId: input.userId,
      isOfficial: input.isOfficial,
      country: input.country,
    })

    const items = input.rows.map((row, idx) => ({
      id: crypto.randomUUID(),
      quiz_set_id: setId,
      position: idx + 1,
      front: row.front,
      back: row.back,
      example: row.example,
    }))
    await upsertItems.mutateAsync(items)

    return setId
  }

  return {
    submit,
    isPending: createSet.isPending || upsertItems.isPending,
  }
}
