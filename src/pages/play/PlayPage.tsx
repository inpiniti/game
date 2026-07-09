import { useEffect, useMemo, useRef, useState } from 'react'
import type Phaser from 'phaser'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createSurvivalGame, expForKills } from '../../game/survival'
import type { SurvivalGameOver, SurvivalTexts } from '../../game/survival'
import { i18n } from '../../shared/i18n'
import { useQuizItems } from '../../entities/quiz-item'
import type { QuizItem } from '../../entities/quiz-item'
import { useCurrentUser } from '../../entities/user'
import { useUserStats } from '../../entities/player-stats'
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
  // 성장(레벨·경험치) — apply_game_result RPC 성공 시에만 채워진다(설계 v10 §17-3).
  // RPC 실패해도 결과 화면 진입은 막지 않으므로(save-session 기존 정책) 전부 옵셔널 —
  // 값이 없으면 ResultPage가 레벨업 표시를 생략한다.
  levelBefore?: number
  levelAfter?: number
  expGained?: number
  leveledUp?: boolean
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
    dodge: t('game.dodge'),
    miss: t('game.miss'),
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
    // 레벨업 배분 오버레이(설계 v10 §18-1) — 2b가 texts.ts에 넣은 필드를 game.stat.*/game.levelUp.* 로 매핑.
    levelUpTitle: t('game.levelUp.title'),
    statStr: { name: t('game.stat.str.name'), desc: t('game.stat.str.desc') },
    statAgi: { name: t('game.stat.agi.name'), desc: t('game.stat.agi.desc') },
    statSta: { name: t('game.stat.sta.name'), desc: t('game.stat.sta.desc') },
    statPicked: t('game.levelUp.picked'),
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
  // 현재 레벨·스탯 — 게임 생성 시 initialStats로 주입(§17-1). 행이 없거나 조회가 실패해도
  // DEFAULT_PLAYER_STATS로 폴백되므로(entities/player-stats) 게임 시작을 막는 치명적 게이트가 아니다.
  const { stats: userStats, isLoading: statsLoading } = useUserStats()
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
  // 캔버스 레벨업 배분 패널(씬 내부 오버레이)이 떠 있는 동안 true — 씬이 'app:levelup-open/close'를
  // emit(React→씬 'app:pause/resume/quit'과 같은 game.events 버스를 반대 방향으로 사용)하면 갱신.
  // 퀴즈 오버레이와 마찬가지로 이 상태에서도 ⏸ 버튼을 숨겨 일시정지 중복·유령 버튼을 막는다.
  const [levelUpOpen, setLevelUpOpen] = useState(false)
  // 씬은 한 판 1회만 onGameOver를 부르지만, StrictMode 이중 마운트/재마운트에 대비한 가드.
  const gameOverHandledRef = useRef(false)
  // 게임 생성(주입) 시점의 레벨 스냅샷 — 결과 화면의 levelBefore용(§17-3). 판 도중 레벨업해도
  // 이 값은 바뀌지 않는다(주입 당시 레벨 그대로).
  const levelBeforeRef = useRef(1)

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
          // 3번째 write: apply_game_result RPC(서버가 경험치 재계산 + 배분을 예산으로 캡, §17-2).
          // 성공 시 반환된 새 user_stats로 결과 화면의 레벨업 표시를 채운다.
          const stats = await saveSession.mutateAsync({
            userId,
            quizSetId: setId,
            direction: DIRECTION,
            score: result.score,
            seconds: result.seconds,
            answers,
            killsByTier: result.killsByTier,
            allocations: result.allocations,
          })
          resultState.levelBefore = levelBeforeRef.current
          resultState.levelAfter = stats.level
          resultState.expGained = expForKills(result.killsByTier)
          resultState.leveledUp = stats.level > levelBeforeRef.current
        } catch {
          // 저장 실패해도 결과 화면 진입은 막지 않는다 (기록/SRS/스탯 갱신만 유실 — 레벨업 표시는 생략).
        }
      }
      navigate('/result', { state: resultState, replace: true })
    }

    void saveAndNavigate()
  }

  useEffect(() => {
    if (!source) return // 문항 준비된 뒤에만 게임 생성
    if (statsLoading) return // 스탯 조회가 성공/실패로 끝난 뒤에만(§17-1) — 실패해도 곧 풀리므로 무한 대기 아님
    const host = hostRef.current
    if (!host) return

    gameOverHandledRef.current = false
    levelBeforeRef.current = userStats.level
    setLevelUpOpen(false)   // 새 게임 인스턴스 시작 — 이전 판의 오버레이 상태를 들고 오지 않는다
    // i18n 인스턴스의 t를 직접 사용 — useTranslation의 t를 effect 의존성에 넣으면
    // 언어 변경 시 게임이 재생성되므로 피한다(판 도중 언어 전환 미지원, 설계 v9 13-3).
    // userStats도 같은 이유로 의존성에서 뺀다 — 게임 생성 시점의 스냅샷만 주입하면 되고,
    // RPC 성공 후 쿼리 무효화로 값이 갱신돼도(§17-2) 진행 중인 판을 재생성하면 안 된다.
    const game = createSurvivalGame(
      host,
      {
        requestQuiz: () => requestRef.current(),
        onGameOver: (result) => handleGameOverRef.current(result),
      },
      buildSurvivalTexts(i18n.t),
      userStats,
    )
    gameRef.current = game
    const handleLevelUpOpen = () => setLevelUpOpen(true)
    const handleLevelUpClose = () => setLevelUpOpen(false)
    game.events.on('app:levelup-open', handleLevelUpOpen)
    game.events.on('app:levelup-close', handleLevelUpClose)
    return () => {
      game.events.off('app:levelup-open', handleLevelUpOpen)
      game.events.off('app:levelup-close', handleLevelUpClose)
      gameRef.current = null
      game.destroy(true)
    }
  }, [source, statsLoading])

  if (isLoading || srsLoading) return <PlayMessage>{t('common.loadingQuizSet')}</PlayMessage>
  if (isError || !items || items.length === 0)
    return <PlayMessage>{t('common.quizSetLoadError')}</PlayMessage>

  return (
    <>
      <div ref={hostRef} style={{ position: 'fixed', inset: 0, touchAction: 'none' }} />
      <PauseControls gameRef={gameRef} hidden={!!current || levelUpOpen} />
      {current && <QuizOverlay key={current.seq} question={current.q} onAnswer={answer} />}
    </>
  )
}
