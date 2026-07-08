import type { QuizItem } from '../../../entities/quiz-item'
import { splitVariants } from '../../../shared/lib/answer'
import { applySm2Grade, DEFAULT_SM2_CARD, type Sm2Card } from '../../../shared/lib/sm2'
import type { AnswerLog, QuizQuestion, QuizSource } from './contract'
import type { Direction } from './createRandomQuizSource'

// 게임 시작 시 넘겨받는 SRS 스냅샷(그 문제집 항목들의 내 srs_progress 행).
export interface SrsSnapshotRow {
  quiz_item_id: string
  repetition: number
  lapses: number
  ease_factor: number
  interval_days: number
  due_at: string
}

interface CardState extends Sm2Card {
  dueAtMs: number
  seen: boolean // 이전 판까지의 학습 이력 존재 여부(스냅샷에 행이 있었나)
}

const BATCH_SIZE = 10 // 신규 단어 배치 크기 (설계 §12 튜닝 대상)
const WRONG_COOLDOWN = 5 // 이번 판 오답 재출제까지 턴 수
const DAY_MS = 86_400_000

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 단계 7 출제 엔진 — SRS 우선순위 + 배치 실시간 해제 + 오답 쿨다운 + 자동 승급(설계 §7).
//  · 우선순위: (0)오답 쿨다운 만료 → (1)복습 예정(due≤now, 오래된 순) → (2)현재 배치 미학습 신규 → (3)나머지 due 임박순
//  · 배치: 현재 배치 전원 repetition≥1이면 다음 BATCH_SIZE개 즉시 합류
//  · 방식: repetition 0~1 → choice(3지선다) / repetition≥2 → input(직접입력)
//  모든 상태는 in-memory (게임 중 DB 미접근). 종료 시 save-session이 영속한다.
export function createSrsQuizSource(
  items: QuizItem[],
  snapshot: SrsSnapshotRow[],
  direction: Direction,
  onReport?: (log: AnswerLog) => void,
): QuizSource {
  const nowMs = Date.now()
  const sideOf = (it: QuizItem) => (direction === 'front-back' ? it.back : it.front)
  const promptOf = (it: QuizItem) => (direction === 'front-back' ? it.front : it.back)

  const order = items.map((i) => i.id) // position 순 (useQuizItems가 position 정렬)
  const itemById = new Map(items.map((i) => [i.id, i]))
  const snapById = new Map(snapshot.map((r) => [r.quiz_item_id, r]))

  const cards = new Map<string, CardState>()
  for (const it of items) {
    const row = snapById.get(it.id)
    cards.set(
      it.id,
      row
        ? {
            ease_factor: row.ease_factor,
            interval_days: row.interval_days,
            repetition: row.repetition,
            lapses: row.lapses,
            dueAtMs: Date.parse(row.due_at),
            seen: true,
          }
        : { ...DEFAULT_SM2_CARD, dueAtMs: nowMs, seen: false },
    )
  }

  let batchCount = Math.min(BATCH_SIZE, order.length)
  let turn = 0
  let lastServed: string | null = null
  const cooldown: { id: string; dueTurn: number }[] = []
  const cooldownIds = new Set<string>() // 쿨다운 중인 항목은 일반 선택(1~3순위)에서 제외

  const unlocked = () => order.slice(0, batchCount)
  function maybeUnlock() {
    if (batchCount >= order.length) return
    if (unlocked().every((id) => cards.get(id)!.repetition >= 1)) {
      batchCount = Math.min(order.length, batchCount + BATCH_SIZE)
    }
  }
  const notLast = (ids: string[]) => (ids.length > 1 ? ids.filter((id) => id !== lastServed) : ids)

  function chooseId(): string | null {
    if (order.length === 0) return null

    // 0) 오답 쿨다운 만료분 재출제
    const ready = cooldown.filter((c) => c.dueTurn <= turn).map((c) => c.id)
    if (ready.length) {
      const chosen = pick(notLast(ready))
      for (let i = cooldown.length - 1; i >= 0; i--) if (cooldown[i].id === chosen) cooldown.splice(i, 1)
      cooldownIds.delete(chosen)
      return chosen
    }

    const free = (ids: string[]) => ids.filter((id) => !cooldownIds.has(id))

    // 1순위: 복습 예정 (이전 판까지 이력 있고 due 지남), 오래된 due 먼저
    const due = free(order.filter((id) => cards.get(id)!.seen && cards.get(id)!.dueAtMs <= nowMs)).sort(
      (a, b) => cards.get(a)!.dueAtMs - cards.get(b)!.dueAtMs,
    )
    const dueF = notLast(due)
    if (dueF.length) return dueF[0]

    // 2순위: 현재 배치의 미학습 신규 (rep 0), position 순
    const news = notLast(free(unlocked().filter((id) => cards.get(id)!.repetition === 0)))
    if (news.length) return news[0]

    // 3순위: 나머지 due 임박순
    const rest = notLast(free([...order]).sort((a, b) => cards.get(a)!.dueAtMs - cards.get(b)!.dueAtMs))
    if (rest.length) return rest[0]

    // 폴백: 전부 쿨다운 중이면 가장 이른 쿨다운을 앞당겨 낸다
    if (cooldown.length) {
      const soonest = [...cooldown].sort((a, b) => a.dueTurn - b.dueTurn)[0].id
      for (let i = cooldown.length - 1; i >= 0; i--) if (cooldown[i].id === soonest) cooldown.splice(i, 1)
      cooldownIds.delete(soonest)
      return soonest
    }
    return order[0]
  }

  function build(id: string): QuizQuestion {
    const item = itemById.get(id)!
    const card = cards.get(id)!
    const prompt = splitVariants(promptOf(item))[0] ?? promptOf(item)
    const correctVariants = splitVariants(sideOf(item))
    const mode: 'choice' | 'input' = card.repetition >= 2 ? 'input' : 'choice'

    if (mode === 'input') {
      return {
        itemId: id,
        prompt,
        mode,
        choices: [],
        correctIndices: [],
        answers: correctVariants,
        example: item.example ?? undefined,
      }
    }

    const correct = correctVariants[0] ?? sideOf(item)
    const distractPool = [
      ...new Set(
        items
          .filter((x) => x.id !== id)
          .map((x) => splitVariants(sideOf(x))[0])
          .filter((d): d is string => !!d && !correctVariants.includes(d)),
      ),
    ]
    const distractors = shuffle(distractPool).slice(0, 2)
    const choices = shuffle([correct, ...distractors])
    const correctIndices = choices.map((c, i) => (correctVariants.includes(c) ? i : -1)).filter((i) => i >= 0)

    return {
      itemId: id,
      prompt,
      mode,
      choices,
      correctIndices,
      answers: correctVariants,
      example: item.example ?? undefined,
    }
  }

  return {
    next(): QuizQuestion | null {
      const id = chooseId()
      if (!id) return null
      lastServed = id
      return build(id)
    },
    report(log: AnswerLog) {
      turn++
      const card = cards.get(log.itemId)
      if (card) {
        const nextCard = applySm2Grade(card, log.correct)
        card.ease_factor = nextCard.ease_factor
        card.interval_days = nextCard.interval_days
        card.repetition = nextCard.repetition
        card.lapses = nextCard.lapses
        card.seen = true
        // in-memory due: 정답이면 미래로(이번 판 재출제 억제), 오답이면 쿨다운이 재출제를 담당
        card.dueAtMs = log.correct ? nowMs + nextCard.interval_days * DAY_MS : nowMs + DAY_MS
        if (!log.correct) {
          cooldown.push({ id: log.itemId, dueTurn: turn + WRONG_COOLDOWN })
          cooldownIds.add(log.itemId)
        }
        maybeUnlock()
      }
      onReport?.(log)
    },
  }
}
