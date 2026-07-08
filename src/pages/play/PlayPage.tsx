import { useEffect, useMemo, useRef } from 'react'
import type Phaser from 'phaser'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { createSurvivalGame } from '../../game/survival'
import type { SurvivalGameOver } from '../../game/survival'
import { useQuizItems } from '../../entities/quiz-item'
import type { QuizItem } from '../../entities/quiz-item'
import { useCurrentUser } from '../../entities/user'
import {
  createSrsQuizSource,
  readLastDirection,
  useQuizController,
  type AnswerLog,
  type Direction,
} from '../../features/play-quiz'
import { useSaveSession } from '../../features/save-session'
import { useSrsProgressBySet } from '../../entities/srs-progress'
import { QuizOverlay } from '../../widgets/quiz-overlay/QuizOverlay'
import { PauseControls } from '../../widgets/pause-menu/PauseControls'

interface PlayRouteState {
  direction?: Direction
}

// 방향 선택 시트(widgets/direction-sheet)가 navigate state로 넘긴 값을 우선 쓰고,
// 없으면(직접 URL 진입 등) 마지막으로 선택했던 방향(localStorage)을, 그마저 없으면 front→back을 쓴다.
// 방향 "해석"만 바뀔 뿐 게임/브리지/오버레이 배선은 그대로다.
function resolveDirection(state: unknown): Direction {
  const direction = (state as PlayRouteState | null)?.direction
  if (direction === 'front-back' || direction === 'back-front') return direction
  return readLastDirection()
}

// pages/result/ResultPage.tsx의 ResultState와 같은 형태 — 페이지 간 직접 import 대신
// navigate state 계약으로만 연결한다(FSD: 같은 레이어끼리 서로 import 하지 않음).
interface ResultState {
  score: number
  kills: number
  seconds: number
  correct: number
  total: number
  setId: string
  setTitle?: string
  wrongWords: { front: string; given: string; back: string }[]
}

function PlayMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        textAlign: 'center',
        color: 'var(--muted)',
      }}
    >
      {children}
    </div>
  )
}

// 서바이벌 플레이 페이지 — Phaser 마운트 + DOM 퀴즈 오버레이 + 일시정지 컨트롤.
// 문항을 DB에서 로드해 QuizSource를 만들고, 게임과 브리지로 잇는다.
// 게임오버(죽음/그만하기 모두 씬이 onGameOver 1회 호출) 시 세션을 저장하고 결과 화면으로 이동한다.
export function PlayPage() {
  const { setId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useCurrentUser()
  const { data: items, isLoading, isError } = useQuizItems(setId)
  const { data: srs, isLoading: srsLoading } = useSrsProgressBySet(setId)
  const saveSession = useSaveSession()

  const DIRECTION: Direction = resolveDirection(location.state)

  // 게임 시작 시점의 SRS 스냅샷으로 출제 엔진을 만든다(설계 §7). 판 중에는 in-memory로 갱신,
  // 종료 시 save-session이 DB에 영속한다. items·srs 둘 다 준비된 뒤에만 소스를 만든다.
  const source = useMemo(
    () =>
      items && items.length > 0 && srs !== undefined
        ? createSrsQuizSource(items, srs, DIRECTION)
        : null,
    [items, srs, DIRECTION],
  )
  const { current, requestQuiz, answer, answersRef } = useQuizController(source)

  // 브리지는 게임 생성 시 1회 캡처되므로, 최신 requestQuiz를 ref로 참조.
  const requestRef = useRef(requestQuiz)
  requestRef.current = requestQuiz

  // itemId → QuizItem — 결과 화면의 틀린 단어 표(front/back) 구성용.
  const itemsById = useMemo(() => {
    const map = new Map<string, QuizItem>()
    for (const item of items ?? []) map.set(item.id, item)
    return map
  }, [items])

  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  // 씬은 한 판 1회만 onGameOver를 부르지만, StrictMode 이중 마운트/재마운트에 대비한 가드.
  const gameOverHandledRef = useRef(false)

  // onGameOver 핸들러는 매 렌더 최신 상태(items, session, setId)를 봐야 하므로 ref 패턴으로 유지.
  const handleGameOverRef = useRef<(result: SurvivalGameOver) => void>(() => {})
  handleGameOverRef.current = (result: SurvivalGameOver) => {
    if (gameOverHandledRef.current) return
    gameOverHandledRef.current = true

    const answers: AnswerLog[] = answersRef.current
    const correct = answers.filter((a) => a.correct).length
    const wrongWords = answers
      .filter((a) => !a.correct)
      .map((a) => {
        const item = itemsById.get(a.itemId)
        return {
          front: item?.front ?? '',
          given: a.given,
          back: item?.back ?? '',
        }
      })

    const resultState: ResultState = {
      score: result.score,
      kills: result.kills,
      seconds: result.seconds,
      correct,
      total: answers.length,
      setId: setId ?? '',
      wrongWords,
    }

    async function saveAndNavigate() {
      const userId = session?.user.id
      if (userId && setId) {
        try {
          await saveSession.mutateAsync({
            userId,
            quizSetId: setId,
            direction: DIRECTION,
            score: result.score,
            seconds: result.seconds,
            answers,
          })
        } catch {
          // 저장 실패해도 결과 화면 진입은 막지 않는다 (기록/SRS 갱신만 유실).
        }
      }
      navigate('/result', { state: resultState, replace: true })
    }

    void saveAndNavigate()
  }

  useEffect(() => {
    if (!source) return // 문항 준비된 뒤에만 게임 생성
    const host = hostRef.current
    if (!host) return

    gameOverHandledRef.current = false
    const game = createSurvivalGame(host, {
      requestQuiz: () => requestRef.current(),
      onGameOver: (result) => handleGameOverRef.current(result),
    })
    gameRef.current = game
    return () => {
      gameRef.current = null
      game.destroy(true)
    }
  }, [source])

  if (isLoading || srsLoading) return <PlayMessage>문제집을 불러오는 중이에요…</PlayMessage>
  if (isError || !items || items.length === 0)
    return <PlayMessage>문제집을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</PlayMessage>

  return (
    <>
      <div ref={hostRef} style={{ position: 'fixed', inset: 0, touchAction: 'none' }} />
      <PauseControls gameRef={gameRef} hidden={!!current} />
      {current && <QuizOverlay key={current.seq} question={current.q} onAnswer={answer} />}
    </>
  )
}
