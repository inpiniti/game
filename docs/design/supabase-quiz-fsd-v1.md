# 설계도 — 퀴즈 DB(Supabase) 연동 + FSD 아키텍처

> ⚠️ **[v2](./supabase-quiz-fsd-v2.md)로 대체됨** — 기술 스택 A안 확정 + 유저별 간격 반복(SRS) 추가.
>
> 작성일: 2026-07-08
> 목표: 게임 중간에 나오는 문제(현재 성경 퀴즈)를 DB에서 가져오고,
> 유저 / 문제집 / 히스토리 / 카테고리 도메인을 갖춘 구조로 확장한다.
> notepad 프로젝트의 Supabase 패턴을 재사용한다.

---

## 1. 현재 상태

| 항목 | 현재 |
|---|---|
| 엔진 | Phaser v3 (CDN, 전역 스크립트, 빌드 도구 없음) |
| 실행 | VS Code Live Server |
| 퀴즈 데이터 | `js/quiz-data.js`에 전역 상수 `QUIZ_DATA` 20문항 하드코딩 |
| 퀴즈 출제 | `SurvivalScene.showQuiz()`가 전역 `QUIZ_DATA`를 직접 참조 (3지선다, 정답 시 업그레이드) |
| 백엔드 | 없음 |

**notepad에서 가져올 패턴** (참고: `notepad/src/lib/supabase.ts`, `notepad/migration.sql`)

- `@supabase/supabase-js` v2 + `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 환경변수
- Supabase Auth(이메일/비밀번호) + `auth.users` 참조하는 `user_id` 컬럼
- 테이블마다 RLS(Row Level Security) 정책으로 유저별 격리

---

## 2. 기술 스택 결정

### 권장: Vite + React + TypeScript 셸 안에 Phaser를 마운트 (A안)

```
React (셸)                        Phaser (게임)
─────────────────────────         ─────────────────────
로그인/회원가입, 로비,        →    서바이벌 씬 (기존 코드 이관)
문제집 선택, 방식 선택,       ←    게임 종료 결과 콜백
히스토리, 결과 화면
```

**이유**

- 로그인 폼, 문제집 목록, 히스토리 테이블 같은 **폼/리스트 UI는 캔버스(Phaser)로 만들면 고통** — DOM(React)이 압도적으로 편하다.
- notepad와 같은 스택(React + supabase-js + zustand + react-query)이라 패턴을 그대로 복붙 수준으로 재사용 가능.
- FSD 레이어 구조가 React 생태계 기준으로 정의돼 있어 자연스럽게 적용된다.
- Phaser는 npm 패키지로 설치되어 CDN/전역 변수 의존이 사라진다.

**대안 (B안): 바닐라 유지 + supabase-js CDN** — 마이그레이션 비용은 0이지만, 로그인/업로드 UI를 캔버스나 생 DOM으로 만들어야 하고, 모듈 시스템이 없어 FSD 레이어 분리가 사실상 불가능. **비추천.**

패키지: `phaser`, `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `react-router-dom`, (선택) `tailwindcss` — 패키지 매니저는 notepad와 동일하게 pnpm.

---

## 3. 도메인 모델

사용자가 정한 도메인을 다듬은 결과. 핵심 변경점 두 가지:

1. **"문제집 = 제목 + csv or json"에서 csv/json은 저장 포맷이 아니라 업로드 입력 포맷**으로 해석한다.
   DB에는 문제를 낱개 행(`quiz_items`)으로 정규화해 저장한다.
   → 오답 리스트가 문제 id를 참조할 수 있고, 문항 단위 수정·통계·재출제가 가능해진다.
2. **"게임 방식"(3지선다/직접입력/랜덤)은 엔티티가 아니라 플레이 시점에 고르는 설정값**이다.
   히스토리에 `settings`(jsonb)로 기록만 한다.

```
categories 1 ─── * quiz_sets 1 ─── * quiz_items
                      │
auth.users 1 ── 1 profiles
     │
     └────── * play_histories * ──── 1 quiz_sets
```

| 도메인 | 테이블 | 설명 |
|---|---|---|
| 카테고리 | `categories` | 문제 형식 정의. `bible`(고정 선택지 퀴즈), `en_word`(단어 짝) |
| 문제집 | `quiz_sets` | 제목, 카테고리, 소유자(null=공용), 공개 여부 |
| 문제 | `quiz_items` | `front`(질문/영단어), `back`(정답/뜻), `choices`(고정 선택지, null이면 런타임 생성) |
| 유저 | `profiles` | Supabase Auth 사용. 닉네임만 별도 테이블 |
| 히스토리 | `play_histories` | 점수, 날짜, 유저, 문제집, 정답 수/전체 수, 오답 리스트, 게임 종류, 플레이 설정 |

- **승률(정답률)은 `correct_count / total_count`로 파생** — 컬럼으로 저장하지 않는다.
- `front`/`back` 범용 구조라 두 카테고리를 하나의 스키마로 수용:
  - 성경 퀴즈: `front`=질문, `back`=정답 텍스트, `choices`=["베들레헴","나사렛","예루살렘"]
  - 영어 단어: `front`=apple, `back`=사과, `choices`=null → 선택지는 같은 문제집의 다른 `back`들로 런타임 생성. 영→한/한→영은 front/back을 뒤집는 방향 설정일 뿐이다.

---

## 4. DB 스키마 (supabase/migrations/0001_init.sql)

```sql
-- 카테고리
create table categories (
  id          text primary key,            -- 'bible', 'en_word'
  name        text not null,               -- '성경', '영어단어'
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
  front       text not null,               -- 질문 / 영단어
  back        text not null,               -- 정답 / 뜻
  choices     jsonb,                       -- 고정 선택지. null이면 런타임 생성
  created_at  timestamptz not null default now()
);

-- 프로필 (닉네임)
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
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

-- 히스토리
create table play_histories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  quiz_set_id   uuid references quiz_sets(id) on delete set null,
  game_type     text not null,             -- 'survival' | 'vocab'
  settings      jsonb not null default '{}',  -- { direction, answer_mode, ... }
  score         int not null default 0,    -- 게임 점수 (서바이벌: 킬수 등)
  correct_count int not null,
  total_count   int not null,
  wrong_items   jsonb not null default '[]',  -- [{ item_id, given }]
  played_at     timestamptz not null default now()
);
```

### RLS 정책 (notepad 패턴 + 공개 읽기 확장)

```sql
alter table quiz_sets      enable row level security;
alter table quiz_items     enable row level security;
alter table profiles       enable row level security;
alter table play_histories enable row level security;
alter table categories     enable row level security;

-- 카테고리: 누구나 읽기
create policy "read categories" on categories for select using (true);

-- 문제집: 공용/공개는 비로그인 포함 누구나 읽기, 쓰기는 소유자만
create policy "read public quiz_sets" on quiz_sets for select
  using (user_id is null or is_public or auth.uid() = user_id);
create policy "write own quiz_sets" on quiz_sets for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 문제: 소속 문제집의 읽기 권한을 따라감
create policy "read items of visible sets" on quiz_items for select
  using (exists (select 1 from quiz_sets s where s.id = quiz_set_id
                 and (s.user_id is null or s.is_public or auth.uid() = s.user_id)));
create policy "write items of own sets" on quiz_items for all
  to authenticated
  using (exists (select 1 from quiz_sets s where s.id = quiz_set_id and auth.uid() = s.user_id))
  with check (exists (select 1 from quiz_sets s where s.id = quiz_set_id and auth.uid() = s.user_id));

-- 프로필: 닉네임은 전체 읽기(랭킹 대비), 수정은 본인만
create policy "read profiles" on profiles for select using (true);
create policy "update own profile" on profiles for update
  to authenticated using (auth.uid() = id);

-- 히스토리: 본인 것만
create policy "own histories" on play_histories for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 시드 (supabase/seed/0001_bible_quiz.sql)

기존 `js/quiz-data.js` 20문항을 공용 문제집으로 옮긴다.

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
├─ index.html                    # Vite 진입 HTML
├─ supabase/
│   ├─ migrations/0001_init.sql
│   └─ seed/0001_bible_quiz.sql
├─ src/
│   ├─ app/                      # 부팅·전역
│   │   ├─ main.tsx              # ReactDOM.render
│   │   ├─ providers.tsx         # QueryClientProvider + 세션 구독 시작
│   │   ├─ router.tsx            # 라우트 정의 (아래 페이지 매핑)
│   │   └─ styles/
│   ├─ pages/
│   │   ├─ login/                # 로그인·회원가입 (features/auth 조합)
│   │   ├─ lobby/                # 게임 선택 (서바이벌 / 단어장)
│   │   ├─ quiz-set-list/        # 문제집 목록·선택 + 업로드 버튼
│   │   ├─ play-survival/        # ★ Phaser 마운트 페이지 (데이터 주입)
│   │   ├─ play-vocab/           # 단어장 게임 (React만으로 구현)
│   │   ├─ result/               # 결과 화면 + 히스토리 저장 트리거
│   │   └─ history/              # 내 기록 목록
│   ├─ widgets/
│   │   ├─ header/               # 닉네임·로그인 상태·로그아웃
│   │   ├─ quiz-set-grid/        # 문제집 카드 그리드 (entities 카드 + 시작 버튼)
│   │   ├─ game-mode-panel/      # 방향(영→한/한→영) + 방식(N지선다/직접입력/랜덤) 선택
│   │   └─ history-table/
│   ├─ features/
│   │   ├─ auth/                 # 로그인/회원가입/로그아웃 (UI + mutation)
│   │   ├─ upload-quiz-set/      # CSV·JSON 파싱 → quiz_sets + quiz_items insert
│   │   ├─ play-quiz/            # ★ 출제 엔진 (순수 로직): 선택지 생성·채점·진행
│   │   └─ save-history/         # GameResult → play_histories insert (mutation)
│   ├─ entities/
│   │   ├─ user/                 # 타입, profiles api, 세션 zustand 스토어
│   │   ├─ category/             # 타입, 목록 조회
│   │   ├─ quiz-set/             # 타입, api(list/get/create), react-query 훅
│   │   ├─ quiz-item/            # 타입, api(bySetId)
│   │   └─ history/              # 타입, api(list/insert), react-query 훅
│   ├─ game/                     # ★ Phaser 영역 — FSD 레이어 밖 별도 구역
│   │   ├─ survival/
│   │   │   ├─ SurvivalScene.ts  # 기존 js/scenes/SurvivalScene.js 이관
│   │   │   ├─ MainScene.ts      # 기존 탐험 씬 이관
│   │   │   ├─ upgrades.ts
│   │   │   └─ index.ts          # createSurvivalGame(el, { quizSource, onEnd })
│   │   └─ assets-manifest.ts    # 기존 tileset-manifest.js 이관
│   └─ shared/
│       ├─ api/supabase.ts       # notepad 패턴: env → createClient
│       ├─ config/               # 상수, env 타입
│       ├─ lib/                  # csv 파서, shuffle, 문자열 정규화(채점용)
│       └─ ui/                   # Button, Modal, Input, Toast
└─ assets/                       # 기존 게임 에셋 그대로 (public/ 이동 검토)
```

**레이어 규칙 (import 방향은 항상 아래로만)**

```
app → pages → widgets → features → entities → shared
                          ↘ game (pages에서만 import)
```

- `process` 레이어는 최신 FSD에서 사실상 폐기 — "문제집 선택 → 방식 선택 → 플레이 → 결과 저장" 흐름은 **pages 라우팅 + features 조합**으로 충분하다. 필요해지면 그때 추가.
- `src/game/`(Phaser)은 FSD 레이어 트리 밖의 독립 구역이다. **entities/shared를 import하지 않고, Supabase의 존재도 모른다.** pages가 데이터를 로드해서 주입한다(6절).

### 장바구니 예시에 대응시키면

| 장바구니 예시 | 이 프로젝트 |
|---|---|
| `entities/product` 상품 데이터 구조 | `entities/quiz-set`, `entities/quiz-item` |
| `features/add-to-cart` 담기 버튼 + API | `features/save-history` 결과 저장, `features/upload-quiz-set` 업로드 |
| `widgets/product-card` 조합 카드 | `widgets/quiz-set-grid` 문제집 카드 그리드 |
| `pages/product-detail` 상세 페이지 | `pages/play-survival`, `pages/play-vocab` |

---

## 6. 핵심 경계 — React ↔ Phaser 브릿지

게임(씬)이 DB를 모르게 하는 것이 이 설계의 핵심 시임(seam)이다.
`SurvivalScene.showQuiz()`의 전역 `QUIZ_DATA` 참조를 **주입받은 인터페이스 호출**로 바꾼다.

```ts
// features/play-quiz/model/types.ts — 게임과 앱이 공유하는 유일한 계약
export interface QuizQuestion {
  itemId: string;
  prompt: string;          // 화면에 보여줄 질문
  choices: string[];       // 선택지 (직접입력 모드면 빈 배열)
  correctIndex: number;
}

export interface QuizSource {
  next(): QuizQuestion;    // 중복 없이 출제, 소진 시 리셋 (기존 usedQuizIndices 로직 흡수)
}

export interface GameResult {
  score: number;
  correctCount: number;
  totalCount: number;
  wrongItems: { itemId: string; given: string }[];
}
```

```ts
// game/survival/index.ts — Phaser 쪽 진입점
export function createSurvivalGame(
  container: HTMLElement,
  opts: { quizSource: QuizSource; onEnd: (r: GameResult) => void },
): Phaser.Game { ... }
```

```tsx
// pages/play-survival/ui/PlaySurvivalPage.tsx — 조립 지점
const { data: items } = useQuizItems(setId);          // entities/quiz-item (react-query)
const quizSource = useMemo(
  () => items && createQuizEngine(items, settings),   // features/play-quiz
  [items, settings],
);
const save = useSaveHistory();                        // features/save-history

useEffect(() => {
  if (!quizSource) return;                            // 로딩 완료 후 게임 시작
  const game = createSurvivalGame(ref.current!, {
    quizSource,
    onEnd: (result) => { save.mutate(result); navigate('/result'); },
  });
  return () => game.destroy(true);
}, [quizSource]);
```

**출제 엔진(`features/play-quiz`)이 카테고리 차이를 흡수한다:**

- `fixed_choices`(성경): `choices` 컬럼 그대로 사용
- `pair`(영어단어): 방향 설정에 따라 front/back 선택 → 같은 문제집의 다른 항목 back에서 오답 N-1개 랜덤 추출해 선택지 구성
- `랜덤` 방식: 문항마다 answer_mode를 랜덤 선택
- 서바이벌 게임도 이 엔진을 그대로 쓰므로, **영어 단어 문제집으로 서바이벌을 돌리는 것도 공짜로 가능**해진다.

단어장 게임(`pages/play-vocab`)은 Phaser 없이 React로 구현한다 — 같은 `QuizSource`를 소비하는 카드 UI.

---

## 7. 상태 관리 전략

| 구분 | 예시 | 도구 |
|---|---|---|
| 서버 상태 | 세션·프로필, 카테고리, 문제집 목록, 문제들, 히스토리 | **react-query** (entities의 api + 쿼리 훅) |
| 클라이언트 상태 (앱) | 선택된 문제집·게임 방식, 모달, 토스트 | **zustand** 얇게 1~2개 스토어 (또는 라우터 state) |
| 클라이언트 상태 (게임) | HP, 킬수, 골드, 퀴즈 진행 카운트 | **Phaser 씬 내부 변수** (현행 유지 — 밖으로 꺼내지 않는다) |

- 세션: `supabase.auth.onAuthStateChange` 구독 → `entities/user`의 zustand 스토어에 반영 (app/providers에서 구독 시작). notepad `store.ts`의 auth 부분과 동일 요령.
- notepad는 서버 데이터 fetch까지 zustand 안에서 했지만, 이 프로젝트는 **서버 상태를 react-query로 분리**한다 (캐싱·로딩·리트라이가 공짜).

---

## 8. 게스트(비로그인) 정책

- 공용/공개 문제집은 **로그인 없이 플레이 가능** (RLS가 anon 읽기 허용).
- 히스토리 저장·문제집 업로드는 로그인 필요 → 게임 종료 시 비로그인이면 "기록을 저장하려면 로그인" 안내.
- 진입 장벽 없이 게임부터 시작할 수 있어 기존 UX가 깨지지 않는다.

---

## 9. 단계별 구현 계획

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0. Vite 이관** | pnpm + Vite + TS 셋업, 기존 js/*를 `src/game/`으로 ESM 이관, Phaser npm 설치 | 기능 변화 없이 `pnpm dev`로 기존 게임 동작 |
| **1. DB 구축** | Supabase 프로젝트 생성, 마이그레이션 + 성경 퀴즈 시드 실행 | 대시보드에서 quiz_sets 1건 + items 20건 확인 |
| **2. 읽기 연동** | `shared/api/supabase.ts` + entities(quiz-set, quiz-item) + play-quiz 엔진, 서바이벌 씬에 QuizSource 주입 | 게임 퀴즈가 DB에서 나옴, `quiz-data.js` 삭제 |
| **3. 인증** | features/auth + profiles + header, 세션 스토어 | 회원가입→닉네임 표시→로그아웃 동작 |
| **4. 히스토리** | save-history + pages/result + pages/history | 게임 종료 시 기록 저장, 목록 조회 |
| **5. 단어장** | 카테고리 en_word, upload-quiz-set(CSV/JSON), game-mode-panel, pages/play-vocab | CSV 업로드한 단어장으로 3방식 플레이 |

각 단계가 독립적으로 배포 가능한 단위다. 0~2까지만 해도 원래 목표("문제를 DB에서 가져오기")는 달성된다.

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

## 10. 추후 결정할 것 (열린 질문)

- **직접입력 채점 규칙**: 대소문자/공백 정규화만? 복수 정답(`사과;능금`) 허용?
- **오답노트**: `wrong_items`를 모아 재출제하는 기능 (스키마는 이미 대비됨)
- **랭킹**: profiles 전체 읽기를 열어둔 이유 — 문제집별 최고 점수 랭킹 확장 여지
- **오프라인 폴백**: notepad처럼 localStorage 폴백을 둘지 (게스트 플레이가 있어 우선순위 낮음)
- **assets 정리**: 1,300여 개 에셋 파일을 Vite `public/`으로 옮길지, 사용분만 추릴지
