import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readLastDirection, saveLastDirection, type Direction } from '../../features/play-quiz'

// 문제집 카드(widgets/quiz-set-grid)·문제집 상세(pages/quiz-set-detail)의 [시작]/[게임 시작] 버튼이
// 공통으로 쓰는 로직 — 일반 문제집(learnLang=null)은 시트 없이 바로 이동, 그 외엔 방향 시트를 띄운다.
// 확정 시 선택을 localStorage에 남겨 다음 방문 때 기본값으로 쓴다(screens-v3 §8).
export function useStartPlay(setId: string, learnLang: string | null) {
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [direction, setDirection] = useState<Direction>(readLastDirection)

  function goToPlay(chosen: Direction) {
    navigate(`/play/${setId}`, { state: { direction: chosen } })
  }

  function requestStart() {
    if (learnLang === null) {
      goToPlay('front-back')
      return
    }
    setDirection(readLastDirection())
    setSheetOpen(true)
  }

  function confirmStart() {
    saveLastDirection(direction)
    setSheetOpen(false)
    goToPlay(direction)
  }

  return {
    sheetOpen,
    closeSheet: () => setSheetOpen(false),
    direction,
    setDirection,
    requestStart,
    confirmStart,
  }
}
