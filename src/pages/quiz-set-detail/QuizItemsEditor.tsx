import { useState } from 'react'
import { useDeleteQuizItem, useUpsertQuizItems, type QuizItem } from '../../entities/quiz-item'
import styles from './QuizItemsEditor.module.css'

interface QuizItemsEditorProps {
  setId: string
  items: QuizItem[]
  onDone: () => void
}

interface DraftRow {
  id: string
  front: string
  back: string
  example: string
  isNew: boolean
}

function toDraftRows(items: QuizItem[]): DraftRow[] {
  return items.map((item) => ({
    id: item.id,
    front: item.front,
    back: item.back,
    example: item.example ?? '',
    isNew: false,
  }))
}

// 개인 문제집 수정 모드 — 단어 행 추가·편집·삭제. [저장하기] 전까지는 로컬 상태(draft)만 바뀐다.
// 저장은 upsert(신규는 클라이언트 uuid로 insert 겸용) + 삭제된 기존 행만 delete 하는 방식으로 한 번에 처리한다.
export function QuizItemsEditor({ setId, items, onDone }: QuizItemsEditorProps) {
  const [rows, setRows] = useState<DraftRow[]>(() => toDraftRows(items))
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const upsertItems = useUpsertQuizItems()
  const deleteItem = useDeleteQuizItem()

  const isSaving = upsertItems.isPending || deleteItem.isPending

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setRows((prev) => [...prev, { id: crypto.randomUUID(), front: '', back: '', example: '', isNew: true }])
  }

  function removeRow(row: DraftRow) {
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    if (!row.isNew) setRemovedIds((prev) => [...prev, row.id])
  }

  async function handleSave() {
    setErrorMessage(null)
    const trimmed = rows.map((row) => ({
      ...row,
      front: row.front.trim(),
      back: row.back.trim(),
      example: row.example.trim(),
    }))

    if (trimmed.some((row) => !row.front || !row.back)) {
      setErrorMessage('빈칸(단어·뜻)을 채우면 저장할 수 있어요.')
      return
    }

    try {
      if (trimmed.length > 0) {
        await upsertItems.mutateAsync(
          trimmed.map((row, idx) => ({
            id: row.id,
            quiz_set_id: setId,
            position: idx + 1,
            front: row.front,
            back: row.back,
            example: row.example || null,
          })),
        )
      }
      for (const id of removedIds) {
        await deleteItem.mutateAsync({ id, quizSetId: setId })
      }
      onDone()
    } catch {
      setErrorMessage('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <div className={styles.editor}>
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.id} className={styles.row}>
            <input
              className={styles.input}
              value={row.front}
              placeholder="단어(front)"
              onChange={(event) => updateRow(row.id, { front: event.target.value })}
            />
            <input
              className={styles.input}
              value={row.back}
              placeholder="뜻(back) · ';'로 여러 뜻"
              onChange={(event) => updateRow(row.id, { back: event.target.value })}
            />
            <input
              className={styles.input}
              value={row.example}
              placeholder="예문(선택)"
              onChange={(event) => updateRow(row.id, { example: event.target.value })}
            />
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => removeRow(row)}
              aria-label="이 단어 삭제"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className={styles.addButton} onClick={addRow}>
        + 단어 추가
      </button>

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      <div className={styles.footer}>
        <button type="button" className={styles.cancelButton} onClick={onDone} disabled={isSaving}>
          닫기
        </button>
        <button
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? '저장하고 있어요…' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
