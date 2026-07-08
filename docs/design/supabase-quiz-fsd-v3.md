# 설계도 v3 — 영단어 학습 게임: Supabase + FSD + SRS + 관리자

> ⚠️ **[v4](./supabase-quiz-fsd-v4.md)로 대체됨** — 게스트 제거, SRS 2등급, 복수 정답, 국가 도입, 랭킹, docs/sql 정리.
>
> 작성일: 2026-07-08 · [v2](./supabase-quiz-fsd-v2.md) 대체
>
> **v2 대비 변경점**
> 1. **성경 카테고리 제거 — 영단어 전용.** `categories` 테이블과 `choices`(고정 선택지) 컬럼 삭제, 문제는 `word`/`meaning` 짝으로 단순화
> 2. **문제집 이원화**: 공식(관리자 등록, 모든 유저 플레이 가능) / 개인(본인 등록, 본인만 사용)
> 3. **관리자 역할 도입**: `profiles.role` + 관리자 전용 메뉴(`pages/admin`)
>
> 유지: 기술 스택 A안(Vite + React + TS + Phaser), SRS(SM-2), 응답 로그 중심 계약, FSD 레이어 구조

---

## 1. 기술 스택 (확정, v2와 동일)

**Vite + React + TypeScript 셸 안에 Phaser를 마운트한다.**

```
React (셸)                        Phaser (게임)
─────────────────────────         ─────────────────────
로그인/회원가입, 로비,        →    서바이벌 씬 (기존 코드 이관)
문제집 선택, 방식 선택,       ←    게임 종료 결과 콜백
복습(SRS), 히스토리, 관리자
```

- 패키지: `phaser`, `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `react-router-dom`, (선택) `tailwindcss` — pnpm.
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (notepad와 동일 이름).

---

## 2. 콘텐츠 모델 — 영단어 전용, 문제집 이원화

문제는 전부 **영단어 짝(`word` / `meaning`)**이다. 방향(영→한 / 한→영)과 방식(N지선다 / 직접입력 / 랜덤)은 플레이 시점 설정이고, 선택지는 항상 같은 문제집의 다른 항목에서 런타임 생성한다. (v2의 고정 선택지 퀴즈 형식은 삭제)

문제집은 두 종류뿐이다:

| | 공식 문제집 | 개인 문제집 |
|---|---|---|
| 등록 | **관리자만** | 로그인 유저 누구나 |
| 플레이 | **모든 유저** (비로그인 포함 — 10절) | **본인만** |
| 수정/삭제 | 관리자 | 본인 |
| 구현 | `is_official = true` | `is_official = false`, `user_id = 본인` |

- 개인 문제집에는 공개 옵션이 없다 (v2의 `is_public` 삭제). "공유하고 싶으면 관리자가 공식으로 승격"이 유일한 공개 경로 — 콘텐츠 품질 관리가 단순해진다.
- 관리자 지정은 초기에는 Supabase 대시보드에서 수동으로 한다: `update profiles set role = 'admin' where id = '...'`

### 권한 매트릭스

| 행위 | 게스트 | 일반 유저 | 관리자 |
|---|---|---|---|
| 공식 문제집 플레이 | ✅ | ✅ | ✅ |
| 개인 문제집 등록·플레이·수정 | ❌ | ✅ (본인 것만) | ✅ (본인 것만) |
| 공식 문제집 등록·수정·삭제 | ❌ | ❌ | ✅ |
| 개인 → 공식 승격 | ❌ | ❌ | ✅ |
| SRS 복습·히스토리 | ❌ | ✅ | ✅ |
| 관리자 메뉴 접근 | ❌ | ❌ | ✅ |

---

## 3. 도메인 모델

```
quiz_sets 1 ─── * quiz_items
    │                │
auth.users 1 ── 1 profiles (role: user | admin)
     │               │
     ├────── * play_histories * ── 1 quiz_sets   (한 판 단위)
     └────── * srs_progress   * ── 1 quiz_items  (카드 한 장 단위)
```

| 도메인 | 테이블 | 설명 |
|---|---|---|
| 문제집 | `quiz_sets` | 제목, 등록자, `is_official`(공식 여부) |
| 단어 | `quiz_items` | `word`(영단어), `meaning`(뜻) |
| 유저 | `profiles` | Supabase Auth + 닉네임 + **role** |
| 히스토리 | `play_histories` | 한 판의 결과: 점수, 정답/전체 수, 오답 리스트, 게임 종류, 설정 |
| 학습 진행 | `srs_progress` | 유저×단어 단위 SRS 상태: EF, 간격, 다음 복습 시각 |

- csv/json은 업로드 입력 포맷일 뿐, DB에는 `quiz_items`로 정규화 (v1부터 동일).
- 승률(정답률)은 `correct_count / total_count`로 파생 — 저장하지 않음.
- `play_histories`(한 판의 기록)와 `srs_progress`(카드 학습 상태)는 게임 종료 시 같은 응답 로그에서 함께 갱신된다.

---

## 4. DB 스키마 (supabase/migrations/0001_init.sql)

```sql
-- 프로필 (닉네임 + 역할)
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- 회원가입 시 프로필 자동 생성 (닉네임은 가입 시 metadata로 전달)
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

-- 관리자 판별 (RLS 정책에서 사용)
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- 문제집
create table quiz_sets (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  user_id     uuid references auth.users(id) on delete cascade,  -- null = 시드(시스템)
  is_official boolean not null default false,   -- true = 공식(관리자 등록, 전체 공개)
  created_at  timestamptz not null default now()
);

-- 단어
create table quiz_items (
  id          uuid primary key default gen_random_uuid(),
  quiz_set_id uuid not null references quiz_sets(id) on delete cascade,
  position    int not null default 0,
  word        text not null,        -- 영단어
  meaning     text not null,        -- 뜻
  created_at  timestamptz not null default now()
);

-- 히스토리 (한 판 단위)
create table play_histories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  quiz_set_id   uuid references quiz_sets(id) on delete set null,
  game_type     text not null,                 -- 'survival' | 'vocab' | 'review'
  settings      jsonb not null default '{}',   -- { direction, answerMode, choiceCount }
  score         int not null default 0,
  correct_count int not null,
  total_count   int not null,
  wrong_items   jsonb not null default '[]',   -- [{ item_id, given }]
  played_at     timestamptz not null default now()
);

-- SRS 학습 진행 (유저 × 단어)
create table srs_progress (
  user_id          uuid not null references auth.users(id) on delete cascade,
  quiz_item_id     uuid not null references quiz_items(id) on delete cascade,
  ease_factor      real not null default 2.5,
  interval_days    real not null default 0,
  repetition       int  not null default 0,
  lapses           int  not null default 0,
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  primary key (user_id, quiz_item_id)
);

create index srs_progress_due_idx on srs_progress (user_id, due_at);
```

### RLS 정책

```sql
alter table profiles       enable row level security;
alter table quiz_sets      enable row level security;
alter table quiz_items     enable row level security;
alter table play_histories enable row level security;
alter table srs_progress   enable row level security;

-- 프로필: 닉네임은 전체 읽기, 수정은 본인만 + nickname 컬럼만 (role 자가 승격 차단)
create policy "read profiles" on profiles for select using (true);
create policy "update own profile" on profiles for update
  to authenticated using (auth.uid() = id);
revoke update on profiles from authenticated;
grant  update (nickname) on profiles to authenticated;
-- role 변경은 대시보드(SQL)에서만 가능

-- 문제집: 공식은 누구나(비로그인 포함) 읽기, 개인은 본인만
create policy "read visible sets" on quiz_sets for select
  using (is_official or auth.uid() = user_id);

-- 개인 문제집: 본인 것만, 공식 플래그는 못 만짐
create policy "write own personal sets" on quiz_sets for all
  to authenticated
  using (auth.uid() = user_id and not is_official)
  with check (auth.uid() = user_id and not is_official);

-- 관리자: 모든 문제집 관리 (공식 등록, 개인→공식 승격 포함)
create policy "admin manages sets" on quiz_sets for all
  to authenticated
  using (is_admin()) with check (is_admin());

-- 단어: 소속 문제집의 권한을 따라감
create policy "read items of visible sets" on quiz_items for select
  using (exists (select 1 from quiz_sets s where s.id = quiz_set_id
                 and (s.is_official or s.user_id = auth.uid())));
create policy "write items of own personal sets" on quiz_items for all
  to authenticated
  using (exists (select 1 from quiz_sets s where s.id = quiz_set_id
                 and s.user_id = auth.uid() and not s.is_official))
  with check (exists (select 1 from quiz_sets s where s.id = quiz_set_id
                      and s.user_id = auth.uid() and not s.is_official));
create policy "admin manages items" on quiz_items for all
  to authenticated
  using (is_admin()) with check (is_admin());

-- 히스토리·SRS: 본인 것만
create policy "own histories" on play_histories for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own srs_progress" on srs_progress for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

> 프론트의 관리자 메뉴 가드는 UX용일 뿐, 실제 보안 경계는 전부 RLS다.

### 시드 (supabase/seed/0001_basic_words.sql)

관리자 계정이 생기기 전에도 콘텐츠가 있도록, `user_id = null`(시스템)인 공식 문제집을 시드한다.

```sql
with s as (
  insert into quiz_sets (title, user_id, is_official)
  values ('기초 영단어', null, true)
  returning id
)
insert into quiz_items (quiz_set_id, position, word, meaning)
select s.id, v.pos, v.word, v.meaning from s, (values
  (1, 'apple',  '사과'),
  (2, 'run',    '달리다'),
  (3, 'book',   '책'),
  (4, 'water',  '물'),
  (5, 'happy',  '행복한')
  -- ... 필요한 만큼
) as v(pos, word, meaning);
```

---

## 5. FSD 폴더 구조

```
game/
├─ index.html
├─ supabase/
│   ├─ migrations/0001_init.sql
│   └─ seed/0001_basic_words.sql
├─ src/
│   ├─ app/
│   │   ├─ main.tsx
│   │   ├─ providers.tsx         # QueryClientProvider + 세션 구독 시작
│   │   ├─ router.tsx            # 라우트 + RequireAuth / RequireAdmin 가드
│   │   └─ styles/
│   ├─ pages/
│   │   ├─ login/
│   │   ├─ lobby/                # 게임 선택 + "오늘의 복습" 배지
│   │   ├─ quiz-set-list/        # 탭: [공식 문제집] [내 문제집(+업로드)]
│   │   ├─ play-survival/        # ★ Phaser 마운트 (데이터 주입)
│   │   ├─ play-vocab/           # 단어장 게임 (React)
│   │   ├─ review/               # SRS 복습 세션 (단어장 UI 재사용)
│   │   ├─ result/               # 결과 + 히스토리·SRS 저장 트리거
│   │   ├─ history/
│   │   └─ admin/                # ★ 관리자 전용 (RequireAdmin)
│   │       ├─ sets/             #   공식 문제집 목록·수정·삭제·개인 승격
│   │       └─ upload/           #   공식 문제집 등록 (upload-quiz-set 재사용)
│   ├─ widgets/
│   │   ├─ header/               # 닉네임·로그아웃 + 관리자일 때만 "관리" 메뉴 노출
│   │   ├─ quiz-set-grid/        # 문제집 카드 그리드 (공식/개인 공용)
│   │   ├─ game-mode-panel/      # 방향(영→한/한→영) + 방식(N지선다/직접입력/랜덤)
│   │   ├─ due-today/            # 문제집별 복습 예정 수 배지
│   │   └─ history-table/
│   ├─ features/
│   │   ├─ auth/                 # 로그인/회원가입/로그아웃
│   │   ├─ upload-quiz-set/      # CSV·JSON 파싱 → insert (개인/공식 겸용: isOfficial 인자)
│   │   ├─ manage-quiz-set/      # ★ 수정·삭제·공식 승격 (mutation)
│   │   ├─ play-quiz/            # 출제 엔진: 선택지 생성·채점·응답 로그
│   │   ├─ srs/                  # SM-2 계산(순수 함수) + 출제 우선순위 전략
│   │   └─ save-session/         # 게임 종료 → 히스토리 insert + SRS upsert
│   ├─ entities/
│   │   ├─ user/                 # 세션 zustand 스토어, profiles api (role 포함)
│   │   ├─ quiz-set/             # 타입, api(officialList/myList/get/...), 쿼리 훅
│   │   ├─ quiz-item/
│   │   ├─ history/
│   │   └─ srs-progress/
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
│       ├─ lib/                  # csv 파서, shuffle, 문자열 정규화(채점)
│       └─ ui/
└─ assets/
```

**레이어 규칙 (import는 항상 아래 방향으로만)**

```
app → pages → widgets → features → entities → shared
                          ↘ game (pages에서만 import)
```

- v2 대비: `entities/category` 삭제, `pages/admin`·`features/manage-quiz-set` 추가.
- 라우트 가드는 `app/router`에 두고 `entities/user`의 세션 스토어(role)를 읽는다.
  `RequireAdmin`: role ≠ admin이면 로비로 redirect. (보안은 RLS가 담당, 가드는 UX)
- `src/game/`(Phaser)은 여전히 Supabase의 존재를 모른다.

---

## 6. 게임↔앱 계약 — 응답 로그 중심 (v2와 동일)

```ts
// features/play-quiz/model/types.ts
export interface QuizQuestion {
  itemId: string;
  prompt: string;           // 방향에 따라 word 또는 meaning
  choices: string[];        // 직접입력 모드면 빈 배열
  correctIndex: number;
}

export interface AnswerLog {
  itemId: string;
  given: string;
  correct: boolean;
  elapsedMs: number;        // easy 등급 판정용
}

export interface QuizSource {
  next(): QuizQuestion;             // SRS 우선순위 + 세션 내 오답 재출제 반영
  report(log: AnswerLog): void;     // 엔진에 응답 통지 (재출제 큐 관리)
}

export interface GameResult {
  score: number;
  answers: AnswerLog[];             // correct/total/wrong은 여기서 파생
}
```

```tsx
// pages/play-survival — 조립 지점
const { data: items }    = useQuizItems(setId);
const { data: progress } = useSrsProgress(setId);      // 비로그인 = 빈 배열
const quizSource = useMemo(
  () => items && createQuizEngine(items, progress ?? [], settings),
  [items, progress, settings],
);
const save = useSaveSession();

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

**출제 엔진 (영단어 전용으로 단순화)**

- 방향 설정에 따라 `word ↔ meaning`을 뒤집어 문제/정답을 정한다.
- 선택지는 같은 문제집의 다른 항목 정답 쪽에서 오답 N-1개를 랜덤 추출 (N = 3~5 설정).
- `랜덤` 방식: 문항마다 선택/입력을 랜덤 결정.
- **서바이벌은 항상 선택지 3개 모드** — 게임 템포상 직접입력은 부적합.
- 서바이벌·단어장·복습 세 모드가 모두 이 엔진 하나를 쓴다.

---

## 7. SRS 동작 상세 (v2와 동일)

### 7-1. SM-2 계산 (features/srs — 순수 함수)

라이트너 방식은 도입하지 않는다 — 간격이 고정된 SRS의 특수 케이스라 SM-2가 포함한다.
게임 특성에 맞게 품질 등급은 단순화: 오답 → `again`, 정답 → `good`, 3초 이내 정답 → `easy`(선택 도입).

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

### 7-2. 출제 우선순위 (createQuizEngine 내부 전략)

```
1순위  복습 예정 카드: due_at <= now, 오래된 순
2순위  신규 카드: srs_progress 없음, position 순 — 세션당 상한 N (기본 10)
3순위  나머지: due_at 임박순  ← 서바이벌처럼 출제 수를 예측할 수 없는 모드 대비
+ 세션 내 오답은 몇 문항 뒤 재출제 (엔진 내부 큐, DB 왕복 없음)
```

- 비로그인·SRS 데이터 없음 → progress가 빈 배열 → "전부 신규" = 랜덤 출제와 동일하게 동작.
  **엔진 교체 없이 데이터에 따라 전략이 달라지는 구조.**

### 7-3. 읽기/쓰기 시점

| 시점 | 동작 |
|---|---|
| 플레이 시작 | `quiz_items` + 내 `srs_progress`(해당 세트) 조회 → 엔진 주입 |
| 플레이 중 | DB 접근 없음 (메모리의 응답 로그만) |
| 게임 종료 | `answers`를 아이템별 순서대로 fold → `review()` 적용 → **upsert 1회** + `play_histories` insert 1회 |

### 7-4. 복습 모드 & 오늘의 복습

- `pages/review`: due 카드만으로 세션 구성 (소진 시 신규 상한만큼 추가), `game_type='review'`.
- `widgets/due-today`(로비): 문제집별 복습 예정 수 배지.

```ts
supabase.from('srs_progress')
  .select('quiz_item_id, quiz_items!inner(quiz_set_id)')
  .lte('due_at', new Date().toISOString());
// 클라이언트에서 quiz_set_id로 group by (문제집 수가 적어 충분)
```

---

## 8. 관리자 메뉴

| 화면 | 기능 |
|---|---|
| `admin/sets` | 공식 문제집 목록 — 수정·삭제, **개인 문제집 검색 후 공식으로 승격** |
| `admin/upload` | 공식 문제집 등록 (CSV/JSON, `features/upload-quiz-set`에 `isOfficial: true`) |

- 접근: 헤더에 role이 admin일 때만 "관리" 메뉴 노출 + `RequireAdmin` 라우트 가드.
- 업로드·수정 UI는 개인용과 동일 컴포넌트를 재사용하고 `isOfficial` 플래그만 다르다 — 별도 관리자 전용 위젯을 만들지 않는다.
- 관리자 계정 만들기(초기 1회): 일반 가입 → 대시보드에서 `update profiles set role='admin' where id='...'`.

---

## 9. 상태 관리 전략

| 구분 | 예시 | 도구 |
|---|---|---|
| 서버 상태 | 세션·프로필(role), 문제집, 단어, 히스토리, SRS 진행 | **react-query** (entities의 api + 쿼리 훅) |
| 클라이언트 상태 (앱) | 선택된 문제집·방식, 모달, 토스트 | **zustand** 얇게 (또는 라우터 state) |
| 클라이언트 상태 (게임/세션) | HP·킬수·골드, 응답 로그·재출제 큐 | Phaser 씬 내부 + 엔진 내부 |

- 세션: `supabase.auth.onAuthStateChange` 구독 → `entities/user` zustand 스토어 (app/providers에서 시작). 로그인 시 profile(role 포함)도 함께 로드.
- `save-session` 성공 시 `srs-progress`·`history` 쿼리 invalidate → "오늘의 복습" 배지 자동 갱신.

---

## 10. 게스트(비로그인) 정책

- **공식 문제집 플레이: 로그인 불필요** (RLS가 anon 읽기 허용) — 진입 장벽 없이 게임부터.
- 개인 문제집·업로드·SRS 복습·히스토리: 로그인 필요. 게스트는 랜덤 출제로 플레이하고, 종료 화면에서 "기록·복습 관리는 로그인" 안내.

---

## 11. 단계별 구현 계획

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0. Vite 이관** | pnpm + Vite + TS, 기존 js/* → `src/game/` ESM 이관 | 기능 변화 없이 `pnpm dev`로 기존 게임 동작 |
| **1. DB 구축** | 마이그레이션(전체 스키마) + 기초 영단어 시드 | 대시보드에서 테이블·시드 확인 |
| **2. 읽기 연동** | supabase client + entities + play-quiz 엔진, 서바이벌 퀴즈를 영단어 3지선다로 교체 | 퀴즈가 DB에서 나옴, `quiz-data.js` 삭제 |
| **3. 인증** | features/auth + profiles(role) + header | 회원가입→닉네임 표시→로그아웃 |
| **4. 히스토리** | save-session(히스토리 부분) + result/history 페이지 | 게임 종료 시 기록 저장·조회 |
| **5. 단어장 + 개인 업로드** | play-vocab, 방식 선택, CSV/JSON 업로드(개인) | 내가 올린 단어장으로 3방식 플레이 |
| **6. 관리자 메뉴** | role 가드 + admin/sets + admin/upload + 승격 | 관리자가 공식 문제집 등록, 전체 유저에게 노출 |
| **7. SRS** | features/srs + entities/srs-progress + 복습 모드 + due 배지 | 오답이 빨리, 잘 아는 카드가 늦게 재등장 |

- 스키마는 1단계에서 srs_progress·role까지 한 번에 만들고, 기능은 해당 단계에서 켠다.
- 0~2단계까지만 해도 원래 목표("문제를 DB에서")는 달성.

### CSV / JSON 업로드 포맷 (5·6단계 공용)

```csv
apple,사과
run,달리다
```

```json
{ "title": "중1 영단어",
  "items": [{ "word": "apple", "meaning": "사과" }] }
```

---

## 12. 추후 결정할 것 (열린 질문)

- **게스트 플레이 유지 여부**: 현 설계는 공식 문제집 anon 허용 — 로그인 필수로 조일지
- **관리자 지정 UI**: 당분간 대시보드 SQL로 충분한지, 관리자 화면에 role 관리를 넣을지
- **easy 등급 도입 여부**: 응답 시간 3초 기준이 적절한지, good/again 2등급만 갈지
- **신규 카드 세션 상한**(기본 10)을 유저 설정으로 노출할지
- **직접입력 채점 규칙**: 대소문자/공백 정규화만? 복수 정답(`사과;능금`) 허용?
- **'오늘' 경계와 타임존**: due_at은 UTC 저장, 복습 묶음 표시 기준을 로컬 자정으로 할지
- **랭킹**: profiles 전체 읽기를 열어둔 이유 — 공식 문제집별 최고 점수 랭킹 확장 여지
- **assets 정리**: 1,300여 개 에셋 파일을 Vite `public/`으로 옮길지, 사용분만 추릴지
