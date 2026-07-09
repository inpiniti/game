// 문제집 업로드 파서 — CSV/JSON → front/back/example 행. 업로드 폼(features/upload-quiz-set)의
// 미리보기 + 행 단위 오류 표시가 이 결과를 그대로 렌더링한다. ';' 복수 표기는 그대로 보존(파싱하지 않는다).

import { i18n } from '../i18n'

export interface ParsedQuizRow {
  /** 사람이 읽는 행 번호(1부터) — CSV는 헤더를 건너뛴 만큼 보정된다. */
  row: number
  front: string
  back: string
  example: string | null
  /** null이면 유효한 행. */
  error: string | null
}

export interface ParseQuizResult {
  rows: ParsedQuizRow[]
  validCount: number
  errorCount: number
}

function validate(front: string, back: string): string | null {
  if (!front && !back) return i18n.t('uploadForm.missingBoth')
  if (!front) return i18n.t('uploadForm.missingFront')
  if (!back) return i18n.t('uploadForm.missingBack')
  return null
}

function summarize(rows: ParsedQuizRow[]): ParseQuizResult {
  return {
    rows,
    validCount: rows.filter((r) => !r.error).length,
    errorCount: rows.filter((r) => r.error).length,
  }
}

// RFC4180 간이 구현 — 따옴표로 감싼 필드의 쉼표·줄바꿈·이스케이프("") 처리.
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuotes = false
  let i = 0
  const len = text.length

  while (i < len) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cur += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(cur)
      cur = ''
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
      i++
      continue
    }
    cur += ch
    i++
  }
  // 마지막 줄(개행 없이 끝난 경우)도 채워 넣는다.
  if (cur.length > 0 || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

/**
 * CSV → 파싱 결과. 열 순서는 front,back,example(선택). 헤더 행(front,back,... 로 시작)은 자동으로 건너뛴다.
 * 예시:
 *   front,back,example
 *   apple,사과,I ate an apple.
 *   run,달리다;뛰다,
 */
export function parseQuizCsv(text: string): ParseQuizResult {
  const allRows = parseCsvRows(text).filter((cells) => !(cells.length === 1 && cells[0].trim() === ''))
  if (allRows.length === 0) return summarize([])

  const first = allRows[0].map((c) => c.trim().toLowerCase())
  const hasHeader = first[0] === 'front' && first[1] === 'back'
  const dataRows = hasHeader ? allRows.slice(1) : allRows
  const headerOffset = hasHeader ? 1 : 0

  const rows = dataRows.map((cells, idx) => {
    const front = (cells[0] ?? '').trim()
    const back = (cells[1] ?? '').trim()
    const example = (cells[2] ?? '').trim()
    return {
      row: idx + 1 + headerOffset,
      front,
      back,
      example: example || null,
      error: validate(front, back),
    }
  })

  return summarize(rows)
}

/**
 * JSON → 파싱 결과. 최상위는 배열, 각 원소는 { front, back, example? }.
 * 예시: [{ "front": "apple", "back": "사과", "example": "I ate an apple." }, { "front": "run", "back": "달리다;뛰다" }]
 */
export function parseQuizJson(text: string): ParseQuizResult {
  const trimmed = text.trim()
  if (!trimmed) return summarize([])

  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch {
    return summarize([
      { row: 1, front: '', back: '', example: null, error: i18n.t('uploadForm.jsonSyntaxError') },
    ])
  }

  if (!Array.isArray(data)) {
    return summarize([
      {
        row: 1,
        front: '',
        back: '',
        example: null,
        error: i18n.t('uploadForm.jsonMustBeArray'),
      },
    ])
  }

  const rows = data.map((entry, idx) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const front = typeof rec.front === 'string' ? rec.front.trim() : ''
    const back = typeof rec.back === 'string' ? rec.back.trim() : ''
    const example = typeof rec.example === 'string' ? rec.example.trim() : ''
    return {
      row: idx + 1,
      front,
      back,
      example: example || null,
      error: validate(front, back),
    }
  })

  return summarize(rows)
}

/** 텍스트 내용으로 CSV/JSON을 자동 판별해 파싱한다 — 파일 업로드처럼 형식을 모를 때 사용. */
export function parseQuizAuto(text: string): ParseQuizResult {
  const trimmed = text.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return parseQuizJson(text)
  return parseQuizCsv(text)
}
