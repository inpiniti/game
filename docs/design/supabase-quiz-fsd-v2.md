# 설계도 v2 — 퀴즈 DB(Supabase) + FSD + 간격 반복(SRS)

> ⚠️ **[v3](./supabase-quiz-fsd-v3.md)로 대체됨** — 영단어 전용, 공식/개인 문제집 이원화, 관리자 메뉴 추가.
>
> 작성일: 2026-07-08 · [v1](./supabase-quiz-fsd.md) 대체
>
> **v1 대비 변경점**
> 1. 기술 스택 **A안(Vite + React + TS 셸 + Phaser 마운트) 확정**
> 2. 유저별 **간격 반복 학습(SRS, SM-2 알고리즘)** 추가 — 라이트너 시스템은 도입하지 않음 (2절 이유)
> 3. 게임↔앱 계약에 문항별 응답 로그(`AnswerLog`) 도입 — 히스토리와 SRS가 같은 로그를 소비

---

## 1. 기술 스택 (확정)

**Vite + React + TypeScript 셸 안에 Phaser를 마운트한다.**

```
React (셸)                        Phaser (게임)
─────────────────────────         ─────────────────────
로그인/회원가입, 로비,        →    서바이벌 씬 (기존 코드 이관)
문제집 선택, 방식 선택,       ←    게임 종료 결과 콜백
복습(SRS), 히스토리, 결과
```

- 폼/리스트 UI(로그인, 문제집, 히스토리, 복습 카드)는 React(DOM)로, 게임 플레이만 Phaser로.
- notepad와 동일 스택이라 Supabase 패턴(`supabase.ts`, RLS)을 그대로 재사용.
- 패키지: `phaser`, `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `react-router-dom`, (선택) `tailwindcss` — pnpm.
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (notepad와 동일 이름).

---

## 2. 학습 알고리즘 결정 — 라이트너 대신 SRS(SM-2)

| | 라이트너 | SRS (SM-2) |
|---|---|---|
| 원리 | 박스 N개, 정답 시 다음 박스(고정 주기), 오답 시 1번 박스 | 카드마다 난이도 계수(EF)와 간격을 개별 계산, "잊기 직전"에 복습 |
| 상태 | 박스 번호 하나 | EF·간격·연속정답·다음 복습 시각 |
| 특성 | 단순, 주기 고정 | 카드별 적응형, Anki가 쓰는 방식 |

**결정: SM-2 기반 SRS만 구현한다.**
라이트너는 "간격이 고정된 SRS의 특수 케이스"라서, SRS를 넣으면 사실상 포함된다.
(박스 1·2·3 = 간격 1일·3일·7일로 고정한 것과 같음.) 두 개를 따로 만들 이유가 없다.

게임 특성에 맞게 SM-2의 품질 등급(0~5)은 **2~3등급으로 단순화**한다:

| 등급 | 게임 이벤트 |
|---|---|
| `again` | 오답 |
| `good` | 정답 |
| `easy` (선택 도입) | 빠른 정답 (예: 3초 이내) |

---

## 3. 도메인 모델

```
categories 1 ─── * quiz_sets 1 ─── * quiz_items
                      │                  │
auth.users 1 ── 1 profiles              │
     │                                   │
     ├────── * play_histories * ─────────┤ (quiz_set 단위)
     └────── * srs_progress   * ─────────┘ (quiz_item 단위, 유저별)
```

| 도메인 | 테이블 | 설명 |
|---|---|---|
| 카테고리 | `categories` | 문제 형식 정의. `bible`(고정 선택지), `en_word`(단어 짝) |
| 문제집 | `quiz_sets` | 제목, 카테고리, 소유자(null=공용), 공개 여부 |
| 문제 | `quiz_items` | `front`(질문/영단어), `back`(정답/뜻), `choices`(고정 선택지, null이면 런타임 생성) |
| 유저 | `profiles` | Supabase Auth + 닉네임 |
| 히스토리 | `play_histories` | 한 판의 결과: 점수, 정답/전체 수, 오답 리스트, 게임 종류, 설정 |
| **학습 진행** | **`srs_progress`** | **유저×문제 단위의 SRS 상태: EF, 간격, 다음 복습 시각** |

- v1과 동일: csv/json은 업로드 입력 포맷일 뿐, DB에는 `quiz_items`로 정규화. 게임 방식(N지선다/직접입력/랜덤)은 플레이 설정값. 승률은 파생값.
- **히스토리와 SRS의 역할 구분**: `play_histories`는 "한 판"의 기록(리더보드·통계용), `srs_progress`는 "카드 한 장"의 학습 상태(출제 스케줄용). 같은 응답 로그에서 둘 다 갱신된다.

---

## 4. DB 스키마 (supabase/migrations/0001_init.sql)

```sql
-- 카테고리
create table categories (
  id          text primary key,            -- 'bible', 'en_word'
  name        text not null,
  item_format text not null                -- 'fixed_choices' | 'pair'
);

insert into categories values
  ('bible',   '성경',     'fixed_choices'),
  ('en_word', '영어단어', 'pair');

-- 문제집
create table quiz_sets (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category_id text not null references categories(id),
  user_id     uuid references auth.users(id) on delete cascade,  -- null = 공용(시드)
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 문제
create table quiz_items (
  id          uuid primary key default gen_random_uuid(),
  quiz_set_id uuid not null references quiz_sets(id) on delete cascade,
  position    int not null default 0,
  front       text not null,
  back        text not null,
  choices     jsonb,
  created_at  timestamptz not null default now()
);

-- 프로필
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nickname', '플레이어'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 히스토리 (한 판 단위)
create table play_histories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  quiz_set_id   uuid references quiz_sets(id) on delete set null,
  game_type     text not null,                 -- 'survival' | 'vocab' | 'review'
  settings      jsonb not null default '{}',   -- { direction, answer_mode, ... }
  score         int not null default 0,
  correct_count int not null,
  total_count   int not null,
  wrong_items   jsonb not null default '[]',   -- [{ item_id, given }]
  played_at     timestamptz not null default now()
);

-- ★ SRS 학습 진행 (유저 × 문제 단위)
create table srs_progress (
  user_id          uuid not null references auth.users(id) on delete cascade,
  quiz_item_id     uuid not null references quiz_items(id) on delete cascade,
  ease_factor      real not null default 2.5,   -- SM-2 EF (최소 1.3)
  interval_days    real not null default 0,     -- 현재 복습 간격
  repetition       int  not null default 0,     -- 연속 정답 횟수
  lapses           int  not null default 0,     -- 누적 오답 횟수
  due_at           timestamptz not null default now(),  -- 다음 복습 시각
  last_reviewed_at timestamptz,
  primary key (user_id, quiz_item_id)
);

-- "오늘의 복습" 조회용
create index srs_progress_due_idx on srs_progress (user_id, due_at);
```

### RLS 정책

```sql
alter table categories     enable row level security;
alter table quiz_sets      enable row level security;
alter table quiz_items     enable row level security;
alter table profiles       enable row level security;
alter table play_histories enable row level security;
alter table srs_progress   enable row level security;

create policy "read categories" on categories for select using (true);

-- 문제집: 공용/공개는 비로그인 포함 읽기, 쓰기는 소유자만
create policy "read public quiz_sets" on quiz_sets for select
  using (user_id is null or is_public or auth.uid() = user_id);
create policy "write own quiz_sets" on quiz_sets for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 문제: 소속 문제집의 권한을 따라감
create policy "read items of visible sets" on quiz_items for select
  using (exists (select 1 from quiz_sets s where s.id = quiz_set_id
                 and (s.user_id is null or s.is_public or auth.uid() = s.user_id)));
create policy "write items of own sets" on quiz_items for all
  to authenticated
  using (exists (select 1 from quiz_sets s where s.id = quiz_set_id and auth.uid() = s.user_id))
  with check (exists (select 1 from quiz_sets s where s.id = quiz_set_id and auth.uid() = s.user_id));

create policy "read profiles" on profiles for select using (true);
create policy "update own profile" on profiles for update
  to authenticated using (auth.uid() = id);

create policy "own histories" on play_histories for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SRS: 본인 것만
create policy "own srs_progress" on srs_progress for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 시드 (supabase/seed/0001_bible_quiz.sql)

기존 `js/quiz-data.js` 20문항을 공용 문제집으로 이관 — v1과 동일.

```sql
with s as (
  insert into quiz_sets (title, category_id, user_id, is_public)
  values ('성경 상식 퀴즈', 'bible', null, true)
  returning id
)
insert into quiz_items (quiz_set_id, position, front, back, choices)
select s.id, v.pos, v.front, v.back, v.choices from s, (values
  (1, '예수님이 태어나신 마을은?', '베들레헴', '["베들레헴","나사렛","예루살렘"]'::jsonb),
  (2, '노아의 방주 때 비는 며칠간 내렸나?', '40일', '["7일","40일","100일"]'::jsonb)
  -- ... 나머지 18문항 동일 요령
) as v(pos, front, back, choices);
```

---

## 5. FSD 폴더 구조

```
game/
├─ index.html
├─ supabase/
│   ├─ migrations/0001_init.sql
│   └─ seed/0001_bible_quiz.sql
├─ src/
│   ├─ app/
│   │   ├─ main.tsx
│   │   ├─ providers.tsx         # QueryClientProvider + 세션 구독 시작
│   │   ├─ router.tsx
│   │   └─ styles/
│   ├─ pages/
│   │   ├─ login/
│   │   ├─ lobby/                # 게임 선택 + "오늘의 복습" 위젯
│   │   ├─ quiz-set-list/        # 문제집 목록·선택 + 업로드
│   │   ├─ play-survival/        # ★ Phaser 마운트 (데이터 주입)
│   │   ├─ play-vocab/           # 단어장 게임 (React)
│   │   ├─ review/               # ★ SRS 복습 세션 (단어장 UI 재사용)
│   │   ├─ result/               # 결과 + 히스토리·SRS 저장 트리거
│   │   └─ history/
│   ├─ widgets/
│   │   ├─ header/
│   │   ├─ quiz-set-grid/
│   │   ├─ game-mode-panel/      # 방향 + 방식(N지선다/직접입력/랜덤) 선택
│   │   ├─ due-today/            # ★ 문제집별 복습 예정 수 배지 (로비)
│   │   └─ history-table/
│   ├─ features/
│   │   ├─ auth/
│   │   ├─ upload-quiz-set/      # CSV·JSON 파싱 → insert
│   │   ├─ play-quiz/            # ★ 출제 엔진: 선택지 생성·채점·응답 로그
│   │   ├─ srs/                  # ★ SM-2 계산(순수 함수) + 출제 우선순위 전략
│   │   └─ save-session/         # 게임 종료 → 히스토리 insert + SRS upsert (한 번에)
│   ├─ entities/
│   │   ├─ user/                 # 세션 zustand 스토어, profiles api
│   │   ├─ category/
│   │   ├─ quiz-set/
│   │   ├─ quiz-item/
│   │   ├─ history/
│   │   └─ srs-progress/         # ★ 타입, api(fetchBySet/upsertMany/dueCounts), 쿼리 훅
│   ├─ game/                     # Phaser 영역 — FSD 밖 별도 구역 (pages만 import)
│   │   ├─ survival/
│   │   │   ├─ SurvivalScene.ts
│   │   │   ├─ MainScene.ts
│   │   │   ├─ upgrades.ts
│   │   │   └─ index.ts          # createSurvivalGame(el, { quizSource, onEnd })
│   │   └─ assets-manifest.ts
│   └─ shared/
│       ├─ api/supabase.ts       # notepad 패턴
│       ├─ config/
│       ├─ lib/                  # csv 파서, shuffle, 문자열 정규화
│       └─ ui/
└─ assets/
```

**레이어 규칙 (import는 항상 아래 방향으로만)**

```
app → pages → widgets → features → entities → shared
                          ↘ game (pages에서만 import)
```

- `features/srs`는 순수 계산 + 전략만 갖고, DB 접근은 `entities/srs-progress`의 api를 통해서만.
- v1의 `features/save-history`는 `features/save-session`으로 확장 — 히스토리 insert와 SRS upsert를 한 지점에서 처리(둘 다 같은 응답 로그를 소비하므로).
- `src/game/`(Phaser)은 여전히 Supabase의 존재를 모른다.

---

## 6. 게임↔앱 계약 — 응답 로그 중심으로

v1의 `GameResult.wrongItems`를 **문항별 응답 로그**로 일반화한다.
히스토리(오답 리스트)와 SRS(카드별 등급)가 같은 로그에서 파생되기 때문이다.

```ts
// features/play-quiz/model/types.ts
export interface QuizQuestion {
  itemId: string;
  prompt: string;
  choices: string[];        // 직접입력 모드면 빈 배열
  correctIndex: number;
}

export interface AnswerLog {
  itemId: string;
  given: string;            // 유저가 고른/입력한 답
  correct: boolean;
  elapsedMs: number;        // easy 등급 판정용
}

export interface QuizSource {
  next(): QuizQuestion;     // SRS 우선순위 + 세션 내 오답 재출제 반영
  report(log: AnswerLog): void;  // 엔진에 응답 통지 (재출제 큐 관리)
}

export interface GameResult {
  score: number;
  answers: AnswerLog[];     // correct/total/wrong은 여기서 파생
}
```

```ts
// game/survival/index.ts
export function createSurvivalGame(
  container: HTMLElement,
  opts: { quizSource: QuizSource; onEnd: (r: GameResult) => void },
): Phaser.Game { ... }
```

```tsx
// pages/play-survival — 조립 지점
const { data: items }    = useQuizItems(setId);        // entities/quiz-item
const { data: progress } = useSrsProgress(setId);      // entities/srs-progress (비로그인 = 빈 배열)
const quizSource = useMemo(
  () => items && createQuizEngine(items, progress ?? [], settings),  // features/play-quiz + srs
  [items, progress, settings],
);
const save = useSaveSession();                         // features/save-session

useEffect(() => {
  if (!quizSource) return;
  const game = createSurvivalGame(ref.current!, {
    quizSource,
    onEnd: (r) => { save.mutate({ setId, gameType: 'survival', settings, result: r });
                    navigate('/result'); },
  });
  return () => game.destroy(true);
}, [quizSource]);
```

출제 엔진이 카테고리 차이를 흡수하는 것은 v1과 동일:
`fixed_choices`는 `choices` 컬럼 그대로, `pair`는 방향 설정에 따라 front/back을 뒤집고 같은 문제집의 다른 back에서 오답 선택지를 생성. 서바이벌·단어장·복습 세 모드가 모두 이 엔진 하나를 쓴다.

---

## 7. SRS 동작 상세

### 7-1. SM-2 계산 (features/srs — 순수 함수)

```ts
type Grade = 'again' | 'good' | 'easy';

function review(p: SrsProgress, grade: Grade, now: Date): SrsProgress {
  if (grade === 'again') {
    return { ...p,
      repetition: 0,
      intervalDays: 0,
      easeFactor: Math.max(1.3, p.easeFactor - 0.2),
      lapses: p.lapses + 1,
      dueAt: addMinutes(now, 10),      // 같은 날 다시
      lastReviewedAt: now };
  }
  const rep = p.repetition + 1;
  let interval =
    rep === 1 ? 1 :
    rep === 2 ? 6 :
    Math.round(p.intervalDays * p.easeFactor);
  let ef = p.easeFactor;
  if (grade === 'easy') { ef += 0.1; interval = Math.round(interval * 1.3); }
  return { ...p,
    repetition: rep, intervalDays: interval, easeFactor: ef,
    dueAt: addDays(now, interval), lastReviewedAt: now };
}
```

- 등급 매핑: 오답 → `again`, 정답 → `good`, 정답 + `elapsedMs < 3000` → `easy`(선택 도입).
- 원본 SM-2의 품질 0~5 대신 게임에 맞는 2~3등급 — 이 단순화는 Anki 계열에서도 검증된 방식.

### 7-2. 출제 우선순위 (createQuizEngine 내부 전략)

```
1순위  복습 예정 카드: due_at <= now, 오래된 순
2순위  신규 카드: srs_progress 없음, position 순 — 세션당 상한 N (기본 10)
3순위  나머지: due_at 임박순  ← 서바이벌처럼 출제 수를 예측할 수 없는 모드 대비
+ 세션 내 오답은 몇 문항 뒤 재출제 (엔진 내부 큐, DB 왕복 없음)
```

- 신규 카드 상한이 있어야 첫 플레이에 새 카드가 쏟아져 다음 날 복습이 폭증하는 것을 막는다.
- 비로그인·SRS 미도입 상태에서는 progress가 빈 배열 → 자연스럽게 "전부 신규" = 기존 랜덤 출제와 동일하게 동작한다. **엔진 교체 없이 전략만 데이터에 따라 달라지는 구조.**

### 7-3. 읽기/쓰기 시점

| 시점 | 동작 |
|---|---|
| 플레이 시작 | `quiz_items` + 내 `srs_progress`(해당 세트) 조회 → 엔진에 주입 |
| 플레이 중 | DB 접근 없음 (응답은 메모리의 로그로만) |
| 게임 종료 | `answers`를 아이템별로 순서대로 fold → `review()` 반복 적용 → **upsert 1회** (`onConflict: 'user_id,quiz_item_id'`) + `play_histories` insert 1회 |

- 플레이 중 왕복이 없어 게임 프레임에 영향 없음. 중도 이탈 시 그 판의 진행이 유실되는 것은 감수(한 판 분량이라 손실 작음).

### 7-4. 복습 모드 & 오늘의 복습

- **`pages/review`**: due 카드만으로 세션 구성 (due 소진 시 신규 상한만큼 추가). 단어장 게임 UI 재사용, `game_type='review'`로 히스토리 기록.
- **`widgets/due-today`** (로비): 문제집별 복습 예정 수 배지.

```ts
// entities/srs-progress/api — 문제집별 due 수
supabase.from('srs_progress')
  .select('quiz_item_id, quiz_items!inner(quiz_set_id)')
  .lte('due_at', new Date().toISOString());
// 클라이언트에서 quiz_set_id로 group by (문제집 수가 적어 충분)
```

---

## 8. 상태 관리 전략

| 구분 | 예시 | 도구 |
|---|---|---|
| 서버 상태 | 세션·프로필, 문제집, 문제, 히스토리, **SRS 진행** | **react-query** (entities의 api + 쿼리 훅) |
| 클라이언트 상태 (앱) | 선택된 문제집·방식, 모달, 토스트 | **zustand** 얇게 (또는 라우터 state) |
| 클라이언트 상태 (게임/세션) | HP·킬수·골드, 퀴즈 진행, **세션 내 응답 로그·재출제 큐** | Phaser 씬 내부 + 엔진 내부 (밖으로 꺼내지 않음) |

- 게임 종료 후 `save-session` 성공 시 `srs-progress`·`history` 쿼리 invalidate → 로비의 "오늘의 복습" 배지가 자동 갱신.

---

## 9. 게스트(비로그인) 정책

- 공용/공개 문제집 플레이: 로그인 불필요 (v1과 동일).
- **SRS·복습 모드·히스토리·업로드: 로그인 필요** — SRS는 유저별 상태라 게스트에겐 의미가 없다. 게스트는 랜덤 출제로 플레이하고, 종료 화면에서 "기록·복습 관리는 로그인" 안내.

---

## 10. 단계별 구현 계획

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0. Vite 이관** | pnpm + Vite + TS, 기존 js/* → `src/game/` ESM 이관 | 기능 변화 없이 `pnpm dev`로 기존 게임 동작 |
| **1. DB 구축** | 마이그레이션(srs_progress 포함 전체) + 성경 퀴즈 시드 | 대시보드에서 테이블·시드 확인 |
| **2. 읽기 연동** | supabase client + entities + play-quiz 엔진, 서바이벌에 주입 | 퀴즈가 DB에서 나옴, `quiz-data.js` 삭제 |
| **3. 인증** | features/auth + profiles + header | 회원가입→닉네임 표시→로그아웃 |
| **4. 히스토리** | save-session(히스토리 부분) + result/history 페이지 | 게임 종료 시 기록 저장·조회 |
| **5. 단어장** | en_word 카테고리, CSV/JSON 업로드, 방식 선택, play-vocab | 업로드한 단어장으로 3방식 플레이 |
| **6. SRS** | features/srs + entities/srs-progress + 복습 모드 + due 배지 | 오답이 빨리, 잘 아는 카드가 늦게 재등장; 로비에 복습 수 표시 |

- 스키마는 1단계에서 srs_progress까지 한 번에 만들지만, **기능은 6단계에서 켠다** — 그 전까지 progress가 비어 있어도 엔진은 정상 동작(7-2절).
- 0~2단계까지만 해도 원래 목표("문제를 DB에서")는 달성.

### CSV / JSON 업로드 포맷 (5단계)

```csv
apple,사과
run,달리다
```

```json
{ "title": "중1 영단어", "category": "en_word",
  "items": [{ "front": "apple", "back": "사과" }] }
```

---

## 11. 추후 결정할 것 (열린 질문)

- **easy 등급 도입 여부**: 응답 시간 3초 기준이 적절한지, 아예 good/again 2등급만 갈지
- **신규 카드 세션 상한**(기본 10)을 유저 설정으로 노출할지
- **서바이벌 응답의 SRS 반영 비중**: 반영하되(현 설계) 게임 특성상 등급을 good/again만 쓸지
- **직접입력 채점 규칙**: 대소문자/공백 정규화만? 복수 정답(`사과;능금`) 허용?
- **'오늘' 경계와 타임존**: due_at은 UTC 저장, 복습 묶음 표시 기준을 로컬 자정으로 할지
- **랭킹**: profiles 전체 읽기를 열어둔 이유 — 문제집별 최고 점수 랭킹 확장 여지
- **assets 정리**: 1,300여 개 에셋 파일을 Vite `public/`으로 옮길지, 사용분만 추릴지
