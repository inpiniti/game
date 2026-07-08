# 설계도 v4 — 영단어 학습 게임: Supabase + FSD + SRS + 관리자 + 국가/랭킹

> ⚠️ **[v5](./supabase-quiz-fsd-v5.md)로 대체됨** — 국가 전체 목록, SRS 동일 반영 확정, 랭킹 성능 정책, 전체 랭킹 평균화.
>
> 작성일: 2026-07-08 · [v3](./supabase-quiz-fsd-v3.md) 대체
>
> **v3 대비 변경점 (열린 질문 확정)**
> 1. **게스트 플레이 제거** — 모든 기능 로그인 필수
> 2. **SRS 등급 단순화**: `again`/`good` 2등급 (easy 삭제). 신규 카드 세션 상한은 내부 고정값(10), 설정 UI 없음
> 3. **직접입력 채점: 복수 정답 허용** — `;` 구분 (예: `사과;능금`)
> 4. **국가 도입**: 가입 시 닉네임 + 국가 수집, 공식 문제집은 국가별 운영, 표시용 타임존은 국가에서 유도 (저장은 전부 UTC)
> 5. **랭킹 추가**: 문제집별 / 전체 / 국가 랭킹 (공식 문제집 기록만 집계)
> 6. **SQL 운영 방식 확정**: 실행용 SQL은 [docs/sql/](../sql/README.md)에서 관리, Supabase 대시보드 SQL Editor로 실행. 관리자(1명) 등록 절차는 [docs/sql/03-admin-setup.md](../sql/03-admin-setup.md)
> 7. **assets는 전체를 Vite `public/`으로 이동** (0단계에 포함)
>
> 유지: 기술 스택 A안(Vite + React + TS + Phaser), 공식/개인 문제집 이원화, 응답 로그 중심 계약, FSD 레이어

---

## 1. 기술 스택 (확정)

**Vite + React + TypeScript 셸 안에 Phaser를 마운트한다.**

```
React (셸)                        Phaser (게임)
─────────────────────────         ─────────────────────
로그인/회원가입, 로비,        →    서바이벌 씬 (기존 코드 이관)
문제집 선택, 방식 선택,       ←    게임 종료 결과 콜백
복습(SRS), 히스토리,
랭킹, 관리자
```

- 패키지: `phaser`, `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `react-router-dom`, (선택) `tailwindcss` — pnpm.
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (notepad와 동일 이름).
- 기존 `assets/` 전체를 Vite `public/assets/`로 이동 (경로만 바뀌고 로딩 코드는 동일).

---

## 2. 콘텐츠 모델 — 영단어 전용 + 국가별 공식 문제집

문제는 전부 **영단어 짝(`word` / `meaning`)**. 방향(영→한/한→영)과 방식(N지선다/직접입력/랜덤)은 플레이 시점 설정이고, 선택지는 같은 문제집의 다른 항목에서 런타임 생성한다.

**복수 표기 규칙**: `word`·`meaning` 모두 `;`로 복수 표기를 허용한다 (예: `run` / `달리다;뛰다`).
- **첫 항목이 대표 표기** — 카드·선택지 표시에 사용
- 직접입력 채점 시에는 어느 변형과 일치해도 정답 (8절)

| | 공식 문제집 | 개인 문제집 |
|---|---|---|
| 등록 | **관리자만** (국가 지정 필수) | 로그인 유저 누구나 |
| 플레이 | **자기 국가 대상 문제집** (+ 국가 공통) | 본인만 |
| 수정/삭제 | 관리자 | 본인 |
| 구현 | `is_official = true`, `country` 지정 | `is_official = false`, `user_id = 본인` |

- 공식 문제집의 `country`는 대상 국가(ISO 3166-1 alpha-2, 예: `KR`). **null이면 전체 국가 공통.**
- 국가 필터는 조회 쿼리에서 처리한다 (`country = 내 국가 or country is null`). 보안 사안이 아니므로 RLS는 단순하게 유지.
- 개인 문제집 공개 옵션 없음 — 공유 경로는 "관리자가 공식으로 승격" 하나뿐.

### 권한 매트릭스 (전 기능 로그인 필수)

| 행위 | 일반 유저 | 관리자 |
|---|---|---|
| 공식 문제집 플레이 (자기 국가 + 공통) | ✅ | ✅ |
| 개인 문제집 등록·플레이·수정 | ✅ (본인 것만) | ✅ (본인 것만) |
| 공식 문제집 등록·수정·삭제·개인 승격 | ❌ | ✅ |
| SRS 복습·히스토리·랭킹 조회 | ✅ | ✅ |
| 관리자 메뉴 접근 | ❌ | ✅ |

비로그인 상태에서는 로그인 페이지만 접근 가능 (라우터 전역 `RequireAuth` 가드).

---

## 3. 도메인 모델

```
quiz_sets 1 ─── * quiz_items
    │                │
auth.users 1 ── 1 profiles (nickname, country, role)
     │               │
     ├────── * play_histories * ── 1 quiz_sets   (한 판 단위)
     └────── * srs_progress   * ── 1 quiz_items  (카드 한 장 단위)

랭킹 = play_histories 집계 (별도 테이블 없음, RPC 함수 3개)
```

| 도메인 | 테이블 | 설명 |
|---|---|---|
| 유저 | `profiles` | 닉네임 + **국가** + **role**(user/admin, 관리자는 1명) |
| 문제집 | `quiz_sets` | 제목, 등록자, `is_official`, **`country`**(공식 대상 국가) |
| 단어 | `quiz_items` | `word`/`meaning` (`;` 복수 표기) |
| 히스토리 | `play_histories` | 한 판의 결과: 점수, 정답/전체 수, 오답 리스트, 게임 종류, 설정 |
| 학습 진행 | `srs_progress` | 유저×단어 SRS 상태: EF, 간격, 다음 복습 시각 |

**시간 처리 원칙**: 모든 시각은 UTC(`timestamptz`)로 저장·비교한다. SRS의 due 판정은 절대 시각 비교(`due_at <= now`)라 타임존이 로직에 개입하지 않는다. 국가는 ① 공식 문제집 필터 ② 날짜 **표시**(국가 대표 타임존) ③ 국가 랭킹에만 쓰인다. 국가→타임존 매핑은 `shared/config/countries.ts`에 상수로 둔다 (가입 폼의 국가 select 소스 겸용).

---

## 4. DB 스키마

**실행용 전체 SQL은 [docs/sql/01-init.sql](../sql/01-init.sql)이 단일 기준(source of truth)이다.**
실행 순서·방법은 [docs/sql/README.md](../sql/README.md), 관리자 등록은 [docs/sql/03-admin-setup.md](../sql/03-admin-setup.md) 참고. 여기서는 구조 요점만 발췌한다.

```sql
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
  country    text not null default 'KR',   -- ISO 3166-1 alpha-2
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);
-- 가입 트리거가 metadata의 nickname/country로 자동 생성

create table quiz_sets (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  user_id     uuid references auth.users(id) on delete cascade,  -- null = 시드(시스템)
  is_official boolean not null default false,
  country     text,        -- 공식 문제집 대상 국가, null = 전체 공통
  created_at  timestamptz not null default now()
);

create table quiz_items (
  id          uuid primary key default gen_random_uuid(),
  quiz_set_id uuid not null references quiz_sets(id) on delete cascade,
  position    int not null default 0,
  word        text not null,    -- ';' 구분 복수 표기, 첫 항목이 대표
  meaning     text not null,
  created_at  timestamptz not null default now()
);

-- play_histories, srs_progress 는 v3와 동일 (01-init.sql 참고)
```

**RLS 요점** (전문은 01-init.sql):

- 전 테이블 `to authenticated` — 게스트 제거로 anon 접근 자체가 없다.
- `quiz_sets`/`quiz_items` 읽기: 공식이거나 본인 것. 쓰기: 개인 것은 본인, 공식은 `is_admin()`만.
- `profiles`: 읽기 전체(닉네임·국가 — 랭킹 표시용), 수정은 본인의 `nickname`·`country` 컬럼만
  (컬럼 권한으로 **role 자가 승격을 DB 차원에서 차단** — 승격은 대시보드 SQL로만).
- `play_histories`/`srs_progress`: 본인 것만.
- 랭킹은 `security definer` RPC 3개로만 타인 기록에 접근 (9절) — 집계 결과만 노출되고 원본 히스토리는 계속 본인만 읽는다.

---

## 5. FSD 폴더 구조

```
game/
├─ index.html
├─ docs/
│   ├─ design/                  # 설계 문서 (이 파일)
│   └─ sql/                     # ★ 실행용 SQL — 01-init / 02-seed / 03-admin-setup
├─ public/assets/               # ★ 기존 assets 전체 이동
├─ src/
│   ├─ app/
│   │   ├─ main.tsx
│   │   ├─ providers.tsx        # QueryClientProvider + 세션 구독 시작
│   │   ├─ router.tsx           # RequireAuth(전역) / RequireAdmin 가드
│   │   └─ styles/
│   ├─ pages/
│   │   ├─ login/               # 로그인·회원가입 (닉네임 + 국가 select)
│   │   ├─ lobby/               # 게임 선택 + "오늘의 복습" 배지
│   │   ├─ quiz-set-list/       # 탭: [공식(내 국가+공통)] [내 문제집(+업로드)]
│   │   ├─ play-survival/       # Phaser 마운트 (데이터 주입)
│   │   ├─ play-vocab/          # 단어장 게임 (React)
│   │   ├─ review/              # SRS 복습 세션
│   │   ├─ result/              # 결과 + 히스토리·SRS 저장 트리거
│   │   ├─ history/
│   │   ├─ ranking/             # ★ 탭: 문제집별 / 전체 / 국가 (+ 국가 필터)
│   │   └─ admin/               # 관리자 전용 (RequireAdmin)
│   │       ├─ sets/            #   공식 문제집 목록·수정·삭제·개인 승격
│   │       └─ upload/          #   공식 문제집 등록 (국가 지정 필수)
│   ├─ widgets/
│   │   ├─ header/              # 닉네임·로그아웃 + 관리자일 때만 "관리" 노출
│   │   ├─ quiz-set-grid/
│   │   ├─ game-mode-panel/     # 방향 + 방식(N지선다/직접입력/랜덤)
│   │   ├─ due-today/
│   │   ├─ ranking-table/       # ★ 순위·닉네임·국기·점수
│   │   └─ history-table/
│   ├─ features/
│   │   ├─ auth/                # 로그인/가입(국가 포함)/로그아웃
│   │   ├─ upload-quiz-set/     # CSV·JSON 파싱 → insert (개인/공식 겸용)
│   │   ├─ manage-quiz-set/     # 수정·삭제·공식 승격
│   │   ├─ play-quiz/           # 출제 엔진: 선택지 생성·채점(복수 정답)·응답 로그
│   │   ├─ srs/                 # SM-2 계산(2등급) + 출제 우선순위 전략
│   │   └─ save-session/        # 게임 종료 → 히스토리 insert + SRS upsert
│   ├─ entities/
│   │   ├─ user/                # 세션 zustand 스토어, profiles api (role·country)
│   │   ├─ quiz-set/            # api: officialList(country)/myList/get/...
│   │   ├─ quiz-item/
│   │   ├─ history/
│   │   ├─ srs-progress/
│   │   └─ ranking/             # ★ api: rpc(ranking_by_set/overall/by_country) + 쿼리 훅
│   ├─ game/                    # Phaser 영역 — FSD 밖 별도 구역 (pages만 import)
│   │   ├─ survival/
│   │   │   ├─ SurvivalScene.ts
│   │   │   ├─ MainScene.ts
│   │   │   ├─ upgrades.ts
│   │   │   └─ index.ts         # createSurvivalGame(el, { quizSource, onEnd })
│   │   └─ assets-manifest.ts
│   └─ shared/
│       ├─ api/supabase.ts      # notepad 패턴
│       ├─ config/countries.ts  # ★ { code, name, tz } — 가입 select + 표시 타임존
│       ├─ lib/                 # csv 파서, shuffle, normalize(채점), 복수표기 파서
│       └─ ui/
```

**레이어 규칙**: `app → pages → widgets → features → entities → shared`, `game`은 pages에서만 import. `src/game/`(Phaser)은 Supabase의 존재를 모른다.

---

## 6. 게임↔앱 계약 — 응답 로그 중심

easy 등급 삭제로 `elapsedMs`가 빠져 계약이 더 단순해졌다.

```ts
// features/play-quiz/model/types.ts
export interface QuizQuestion {
  itemId: string;
  prompt: string;           // 방향에 따라 word 또는 meaning의 대표 표기
  choices: string[];        // 직접입력 모드면 빈 배열
  correctIndex: number;
}

export interface AnswerLog {
  itemId: string;
  given: string;            // 고른 선택지 또는 입력한 답
  correct: boolean;
}

export interface QuizSource {
  next(): QuizQuestion;             // SRS 우선순위 + 세션 내 오답 재출제
  report(log: AnswerLog): void;     // 엔진에 응답 통지 (재출제 큐 관리)
}

export interface GameResult {
  score: number;
  answers: AnswerLog[];             // correct/total/wrong은 여기서 파생
}
```

조립 지점(pages/play-survival)과 엔진의 카테고리 처리(방향 뒤집기, 오답 선택지 런타임 생성, 서바이벌은 항상 3지선다)는 v3와 동일.

---

## 7. SRS — SM-2, 2등급

라이트너 방식은 도입하지 않는다(간격 고정형 SRS의 특수 케이스). 등급은 두 개뿐:
**오답 → `again`, 정답 → `good`.**

```ts
type Grade = 'again' | 'good';

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
  const interval =
    rep === 1 ? 1 :
    rep === 2 ? 6 :
    Math.round(p.intervalDays * p.easeFactor);
  return { ...p,
    repetition: rep, intervalDays: interval,
    dueAt: addDays(now, interval), lastReviewedAt: now };
}
```

**출제 우선순위** (엔진 내부 전략, v3와 동일):

```
1순위  복습 예정: due_at <= now, 오래된 순
2순위  신규: srs_progress 없음, position 순 — 세션당 상한 10 (내부 고정, 설정 없음)
3순위  나머지: due_at 임박순
+ 세션 내 오답은 몇 문항 뒤 재출제 (엔진 내부 큐)
```

**읽기/쓰기 시점**: 플레이 시작 시 1회 조회 → 플레이 중 DB 접근 없음 → 종료 시 히스토리 insert 1회 + SRS upsert 1회. `save-session` 성공 시 관련 쿼리 invalidate → "오늘의 복습" 배지 자동 갱신.

---

## 8. 채점 규칙 (직접입력)

```
1. 복수 표기 분해: 정답 필드를 ';'로 split  (예: "달리다;뛰다" → ["달리다", "뛰다"])
2. 정규화: trim → 소문자화(영문) → 연속 공백 1칸으로 축약
3. 입력값이 변형 중 하나와 일치하면 정답
```

- 구현: `shared/lib/answer.ts` — `parseVariants(field)`, `normalize(s)`, `isCorrect(given, field)`.
- 선택지 모드에서는 대표 표기(첫 변형)만 노출하고, 오답 선택지 생성 시 정답의 모든 변형과 겹치는 항목은 제외한다 (`dog: 개;강아지`가 정답일 때 `강아지`가 오답 선택지로 나오는 사고 방지).

---

## 9. 랭킹

**원칙: 공식 문제집 기록만 집계한다.** 개인 문제집은 자기만 아는 쉬운 세트로 점수를 부풀릴 수 있으므로 랭킹에서 제외 — RPC 함수 내부에서 `is_official` join으로 강제한다.

| 랭킹 | 정의 | RPC |
|---|---|---|
| 문제집별 | 해당 공식 문제집에서 유저별 **최고 점수** 순위 | `ranking_by_set(set_id, country?)` |
| 전체 | 유저별 (공식 문제집마다 최고 점수)의 **합산** 순위 | `ranking_overall(country?)` |
| 국가 | 국가별 합산 점수 + 참여 인원 (국가 대항) | `ranking_by_country()` |

- `country?` 파라미터: 문제집별·전체 랭킹을 "같은 국가끼리"로 필터하는 옵션 (랭킹 페이지의 국가 필터).
- 구현: `security definer` SQL 함수 — 히스토리 RLS(본인만)를 우회하되 **집계 결과(닉네임·국가·점수)만** 반환. `anon` 실행 권한은 회수. 전문은 [docs/sql/01-init.sql](../sql/01-init.sql).
- 클라이언트: `entities/ranking`이 `supabase.rpc(...)` 호출 + react-query 캐싱, `pages/ranking`에서 탭 3개로 노출.
- 별도 랭킹 테이블·집계 배치는 두지 않는다 — 유저 규모가 커져 느려지면 그때 materialized view로 전환 (열린 질문).

---

## 10. 관리자 (1명)

- 관리자는 한 명만 둔다. 별도 가입 경로 없이 **일반 가입 후 SQL로 승격** — 절차는 [docs/sql/03-admin-setup.md](../sql/03-admin-setup.md).
- `admin/sets`: 공식 문제집 목록(국가별) — 수정·삭제, 개인 문제집 검색 후 공식 승격(승격 시 대상 국가 지정).
- `admin/upload`: 공식 문제집 등록 — CSV/JSON 업로드 + **국가 지정 필수** (전체 공통이면 "공통" 선택 = null).
- 업로드·수정 UI는 개인용 컴포넌트 재사용, `isOfficial`/`country` 인자만 다름.
- 헤더에 role이 admin일 때만 "관리" 메뉴 노출 + `RequireAdmin` 가드. 실제 보안 경계는 RLS.

---

## 11. 상태 관리 전략

| 구분 | 예시 | 도구 |
|---|---|---|
| 서버 상태 | 세션·프로필(role·country), 문제집, 단어, 히스토리, SRS, 랭킹 | **react-query** (entities api + 쿼리 훅) |
| 클라이언트 상태 (앱) | 선택된 문제집·방식, 모달, 토스트 | **zustand** 얇게 (또는 라우터 state) |
| 클라이언트 상태 (게임/세션) | HP·킬수·골드, 응답 로그·재출제 큐 | Phaser 씬 내부 + 엔진 내부 |

세션: `supabase.auth.onAuthStateChange` 구독 → `entities/user` zustand 스토어. 로그인 시 profile(role·country) 함께 로드. 비로그인이면 라우터가 로그인 페이지로 보낸다.

---

## 12. 단계별 구현 계획

게스트 제거로 **인증이 플레이보다 앞 단계**로 이동했다.

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0. Vite 이관** | pnpm + Vite + TS, js/* → `src/game/` ESM 이관, **assets 전체 → public/** | 기능 변화 없이 `pnpm dev`로 기존 게임 동작 |
| **1. DB 구축** | [docs/sql](../sql/README.md)의 01-init → 02-seed 실행 | 대시보드에서 테이블·시드 확인 |
| **2. 인증** | 가입(닉네임+국가)/로그인 + RequireAuth 게이트 + 03-admin-setup으로 관리자 승격 | 로그인해야만 로비 진입, 관리자 계정 준비 |
| **3. 읽기 연동** | supabase client + entities + play-quiz 엔진, 서바이벌 퀴즈를 영단어 3지선다로 교체 | 퀴즈가 DB에서 나옴, `quiz-data.js` 삭제 |
| **4. 히스토리** | save-session(히스토리 부분) + result/history 페이지 | 게임 종료 시 기록 저장·조회 |
| **5. 단어장 + 개인 업로드** | play-vocab, 방식 선택, CSV/JSON 업로드, 복수 정답 채점 | 내가 올린 단어장으로 3방식 플레이 |
| **6. 관리자 메뉴** | admin/sets + admin/upload(국가 지정) + 승격 | 공식 문제집이 해당 국가 유저에게 노출 |
| **7. SRS** | features/srs + entities/srs-progress + 복습 모드 + due 배지 | 오답이 빨리, 잘 아는 카드가 늦게 재등장 |
| **8. 랭킹** | entities/ranking + pages/ranking (탭 3개 + 국가 필터) | 문제집별/전체/국가 랭킹 표시 |

### CSV / JSON 업로드 포맷 (5·6단계 공용, 복수 표기 포함)

```csv
apple,사과
run,달리다;뛰다
```

```json
{ "title": "중1 영단어",
  "items": [{ "word": "run", "meaning": "달리다;뛰다" }] }
```

---

## 13. 남은 열린 질문

- **국가 목록 범위**: `shared/config/countries.ts`에 몇 개국을 둘지 (초기엔 KR + 소수만 두고 늘려도 됨)
- **서바이벌 응답의 SRS 반영 비중**: 현 설계는 동일 반영 — 게임 템포 특성상 가중치를 낮출지
- **랭킹 성능**: 유저·기록 증가 시 RPC 실시간 집계 → materialized view 전환 시점
- **전체 랭킹 점수 정의**: 현 설계는 "공식 문제집별 최고점 합산" — 문제집 수가 많아지면 상위 N개 합산 등으로 조정할지
