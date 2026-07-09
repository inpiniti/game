import { useEffect, useMemo, useRef } from 'react'
import type Phaser from 'phaser'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createSurvivalGame } from '../../game/survival'
import type { SurvivalGameOver, SurvivalTexts } from '../../game/survival'
import { i18n } from '../../shared/i18n'
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

// 게임에 주입할 번역 사전(설계 v9 13-3) — 씬은 i18n을 모르므로 여기서 t()로 완성해 넘긴다.
// 게임 생성 시점에 1회 캡처되므로 판 도중 언어 변경은 다음 판부터 적용된다(의도된 동작).
function buildSurvivalTexts(t: typeof i18n.t): SurvivalTexts {
  const upgrade = (id: string) => ({
    name: t(`game.upgrades.${id}.name`),
    desc: t(`game.upgrades.${id}.desc`),
  })
  return {
    instructions: t('game.instructions'),
    redeemed: t('game.redeemed'),
    goldQuiz: t('game.goldQuiz'),
    blessingGained: t('game.blessingGained'),
    blessingsTitle: t('game.blessingsTitle'),
    blessingsEmpty: t('game.blessingsEmpty'),
    close: t('game.close'),
    hudTime: t('game.hudTime'),
    hudRedeemed: t('game.hudRedeemed'),
    hudNextQuiz: t('game.hudNextQuiz'),
    hudPierce: t('game.hudPierce'),
    hudQuiz: t('game.hudQuiz'),
    upgrades: {
      arrow_count: upgrade('arrow_count'),
      arrow_rate: upgrade('arrow_rate'),
      arrow_pierce: upgrade('arrow_pierce'),
    },
  }
}

// 서바이벌 플레이 페이지 — Phaser 마운트 + DOM 퀴즈 오버레이 + 일시정지 컨트롤.
// 문항을 DB에서 로드해 QuizSource를 만들고, 게임과 브리지로 잇는다.
// 게임오버(죽음/그만하기 모두 씬이 onGameOver 1회 호출) 시 세션을 저장하고 결과 화면으로 이동한다.
export function PlayPage() {
  const { t } = useTranslation()
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
    // i18n 인스턴스의 t를 직접 사용 — useTranslation의 t를 effect 의존성에 넣으면
    // 언어 변경 시 게임이 재생성되므로 피한다(판 도중 언어 전환 미지원, 설계 v9 13-3).
    const game = createSurvivalGame(
      host,
      {
        requestQuiz: () => requestRef.current(),
        onGameOver: (result) => handleGameOverRef.current(result),
      },
      buildSurvivalTexts(i18n.t),
    )
    gameRef.current = game
    return () => {
      gameRef.current = null
      game.destroy(true)
    }
  }, [source])

  if (isLoading || srsLoading) return <PlayMessage>{t('common.loadingQuizSet')}</PlayMessage>
  if (isError || !items || items.length === 0)
    return <PlayMessage>{t('common.quizSetLoadError')}</PlayMessage>

  return (
    <>
      <div ref={hostRef} style={{ position: 'fixed', inset: 0, touchAction: 'none' }} />
      <PauseControls gameRef={gameRef} hidden={!!current} />
      {current && <QuizOverlay key={current.seq} question={current.q} onAnswer={answer} />}
    </>
  )
}
