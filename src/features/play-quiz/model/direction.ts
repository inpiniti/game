import type { Direction } from './createRandomQuizSource'

// 방향 선택 시트(widgets/direction-sheet)와 PlayPage가 "마지막 선택 기억"을 공유하기 위한 단일 키.
const STORAGE_KEY = 'ddalki:last-direction'

function isDirection(value: unknown): value is Direction {
  return value === 'front-back' || value === 'back-front'
}

/** localStorage에 저장된 마지막 방향, 없거나 값이 이상하면 기본값(front-back). */
export function readLastDirection(): Direction {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isDirection(stored)) return stored
  } catch {
    // 시크릿 모드 등 localStorage 접근 불가 환경 — 기본값으로 진행
  }
  return 'front-back'
}

export function saveLastDirection(direction: Direction): void {
  try {
    localStorage.setItem(STORAGE_KEY, direction)
  } catch {
    // 저장 실패해도 이번 판 진행은 막지 않는다
  }
}
