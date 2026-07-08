// 채점 유틸 — 정규화 + 복수 표기 분리 + 채점

export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

// 'a;b;c' → ['a','b','c'] (첫 항목이 대표 표기)
export function splitVariants(raw: string): string[] {
  return raw
    .split(';')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function gradeChoice(chosenIndex: number, correctIndices: number[]): boolean {
  return correctIndices.includes(chosenIndex)
}

// 직접입력 채점 (단계 7): 순서 무관, 중복 무효, 전부 일치해야 정답
export function gradeInput(given: string[], answers: string[]): boolean {
  const g = given.map(normalize).filter(Boolean)
  const a = answers.map(normalize)
  if (g.length !== a.length) return false
  const pool = [...a]
  for (const x of g) {
    const i = pool.indexOf(x)
    if (i === -1) return false
    pool.splice(i, 1)
  }
  return true
}
