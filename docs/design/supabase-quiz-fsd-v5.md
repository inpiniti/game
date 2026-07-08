# 설계도 v5 — 영단어 학습 게임: Supabase + FSD + SRS + 관리자 + 국가/랭킹

> ⚠️ **[v6](./supabase-quiz-fsd-v6.md)로 대체됨** — 랭킹 요약 테이블 즉시 도입, 신규 카드 배치 해제, 오답 5턴 쿨다운, 학습 과학 기법(자동 승급·예문·취약 단어) 추가.
>
> 작성일: 2026-07-08 · [v4](./supabase-quiz-fsd-v4.md) 대체
>
> **v4 대비 변경점 (마지막 열린 질문 확정 — 이 버전으로 설계 종결)**
> 1. **국가 목록: ISO 3166-1 전체(약 249개국)** — 가입 폼은 검색형 select
> 2. **서바이벌 응답의 SRS 반영: 동일 반영** (가중치 없음)
> 3. **랭킹 성능 정책 확정**: 실시간 RPC로 시작 → 기준 초과 시 요약 테이블(`user_set_best`) + 트리거로 전환 (materialized view는 채택 안 함)
> 4. **전체 랭킹 점수: 합산 → 평균** — 유저별 (공식 문제집별 최고점)의 평균. 국가 랭킹도 평균 기준으로 정합
>
> 유지: 기술 스택 A안, 영단어 전용, 로그인 필수, 공식(관리자 1명·국가별)/개인 문제집 이원화, SRS 2등급(SM-2), 복수 정답 `;` 구분, docs/sql 운영, assets 전체 public/ 이동

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
- 기존 `assets/` 전체를 Vite `public/assets/`로 이동.

---

## 2. 콘텐츠 모델 — 영단어 전용 + 국가별 공식 문제집

문제는 전부 **영단어 짝(`word` / `meaning`)**. 방향(영→한/한→영)과 방식(N지선다/직접입력/랜덤)은 플레이 시점 설정이고, 선택지는 같은 문제집의 다른 항목에서 런타임 생성한다.

**복수 표기 규칙**: `word`·`meaning` 모두 `;`로 복수 표기 허용 (예: `run` / `달리다;뛰다`).
첫 항목이 대표 표기(카드·선택지 표시용), 직접입력 채점은 어느 변형과 일치해도 정답 (8절).

| | 공식 문제집 | 개인 문제집 |
|---|---|---|
| 등록 | **관리자만** (국가 지정 필수) | 로그인 유저 누구나 |
| 플레이 | **자기 국가 대상 문제집** (+ 국가 공통) | 본인만 |
| 수정/삭제 | 관리자 | 본인 |
| 구현 | `is_official = true`, `country` 지정 | `is_official = false`, `user_id = 본인` |

- 공식 문제집의 `country`는 대상 국가(ISO 3166-1 alpha-2), **null이면 전체 국가 공통**.
- 국가 필터는 조회 쿼리에서 처리 (`country = 내 국가 or country is null`). RLS는 단순 유지.
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

## 3. 국가 처리

- **`shared/config/countries.ts`에 ISO 3166-1 alpha-2 전체(약 249개국)를 둔다.**
  항목: `{ code, nameKo, nameEn, tz }` — 공개 ISO 목록에서 스크립트로 생성해 상수화한다.
- 다중 시간대 국가(미국·러시아 등)는 **대표 타임존 1개**만 (예: `US → America/New_York`).
- 가입 폼의 국가 선택은 목록이 길므로 **검색형 select**(타이핑 필터)로 만들고, 기본값은 `KR`
  (또는 `navigator.language`로 추정).
- **시간 처리 원칙**: 모든 시각은 UTC(`timestamptz`)로 저장·비교. SRS due 판정은 절대 시각 비교(`due_at <= now`)라 타임존이 로직에 개입하지 않는다. 국가는 ① 공식 문제집 필터 ② 날짜 **표시**(대표 타임존) ③ 국가 랭킹에만 쓰인다.

---

## 4. 도메인 모델

```
quiz_sets 1 ─── * quiz_items
    │                │
auth.users 1 ── 1 profiles (nickname, country, role)
     │               │
     ├────── * play_histories * ── 1 quiz_sets   (한 판 단위)
     └────── * srs_progress   * ── 1 quiz_items  (카드 한 장 단위)

랭킹 = play_histories 집계 (별도 테이블 없음, RPC 함수 3개 — 10절)
```

| 도메인 | 테이블 | 설명 |
|---|---|---|
| 유저 | `profiles` | 닉네임 + 국가 + role(user/admin, 관리자는 1명) |
| 문제집 | `quiz_sets` | 제목, 등록자, `is_official`, `country` |
| 단어 | `quiz_items` | `word`/`meaning` (`;` 복수 표기) |
| 히스토리 | `play_histories` | 한 판의 결과: 점수, 정답/전체 수, 오답 리스트, 게임 종류, 설정 |
| 학습 진행 | `srs_progress` | 유저×단어 SRS 상태: EF, 간격, 다음 복습 시각 |

---

## 5. DB 스키마

**실행용 전체 SQL은 [docs/sql/01-init.sql](../sql/01-init.sql)이 단일 기준(source of truth)이다.**
실행 순서는 [docs/sql/README.md](../sql/README.md), 관리자 등록은 [docs/sql/03-admin-setup.md](../sql/03-admin-setup.md).

구조 요점 (전문은 01-init.sql):

```sql
profiles       (id, nickname, country default 'KR', role check in ('user','admin'), created_at)
quiz_sets      (id, title, user_id nullable, is_official, country nullable, created_at)
quiz_items     (id, quiz_set_id, position, word, meaning, created_at)
play_histories (id, user_id, quiz_set_id, game_type, settings jsonb, score,
                correct_count, total_count, wrong_items jsonb, played_at)
srs_progress   (user_id, quiz_item_id) pk, ease_factor, interval_days, repetition,
                lapses, due_at, last_reviewed_at
```

**RLS 요점**:

- 전 테이블 `to authenticated` — anon 접근 없음 (게스트 없음).
- `quiz_sets`/`quiz_items`: 읽기는 공식이거나 본인 것, 쓰기는 개인=본인·공식=`is_admin()`.
- `profiles`: 읽기 전체(랭킹 표시용), 수정은 본인의 `nickname`·`country` 컬럼만 — **role 자가 승격은 컬럼 권한으로 차단**, 승격은 대시보드 SQL로만.
- `play_histories`/`srs_progress`: 본인 것만. 타인 기록은 랭킹 RPC(집계 결과만 반환)로만 노출.

---

## 6. FSD 폴더 구조

```
game/
├─ index.html
├─ docs/
│   ├─ design/                  # 설계 문서 (이 파일)
│   └─ sql/                     # 실행용 SQL — 01-init / 02-seed / 03-admin-setup
├─ public/assets/               # 기존 assets 전체 이동
├─ src/
│   ├─ app/
│   │   ├─ main.tsx
│   │   ├─ providers.tsx        # QueryClientProvider + 세션 구독 시작
│   │   ├─ router.tsx           # RequireAuth(전역) / RequireAdmin 가드
│   │   └─ styles/
│   ├─ pages/
│   │   ├─ login/               # 로그인·회원가입 (닉네임 + 국가 검색형 select)
│   │   ├─ lobby/               # 게임 선택 + "오늘의 복습" 배지
│   │   ├─ quiz-set-list/       # 탭: [공식(내 국가+공통)] [내 문제집(+업로드)]
│   │   ├─ play-survival/       # Phaser 마운트 (데이터 주입)
│   │   ├─ play-vocab/          # 단어장 게임 (React)
│   │   ├─ review/              # SRS 복습 세션
│   │   ├─ result/              # 결과 + 히스토리·SRS 저장 트리거
│   │   ├─ history/
│   │   ├─ ranking/             # 탭: 문제집별 / 전체 / 국가 (+ 국가 필터)
│   │   └─ admin/               # 관리자 전용 (RequireAdmin)
│   │       ├─ sets/            #   공식 문제집 목록·수정·삭제·개인 승격
│   │       └─ upload/          #   공식 문제집 등록 (국가 지정 필수)
│   ├─ widgets/
│   │   ├─ header/              # 닉네임·로그아웃 + 관리자일 때만 "관리" 노출
│   │   ├─ quiz-set-grid/
│   │   ├─ game-mode-panel/     # 방향 + 방식(N지선다/직접입력/랜덤)
│   │   ├─ due-today/
│   │   ├─ ranking-table/       # 순위·닉네임·국기·점수·(전체탭) 참여 문제집 수
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
│   │   └─ ranking/             # api: rpc(ranking_by_set/overall/by_country) + 쿼리 훅
│   ├─ game/                    # Phaser 영역 — FSD 밖 별도 구역 (pages만 import)
│   │   ├─ survival/
│   │   │   ├─ SurvivalScene.ts
│   │   │   ├─ MainScene.ts
│   │   │   ├─ upgrades.ts
│   │   │   └─ index.ts         # createSurvivalGame(el, { quizSource, onEnd })
│   │   └─ assets-manifest.ts
│   └─ shared/
│       ├─ api/supabase.ts      # notepad 패턴
│       ├─ config/countries.ts  # ISO 3166-1 전체 { code, nameKo, nameEn, tz }
│       ├─ lib/                 # csv 파서, shuffle, normalize(채점), 복수표기 파서
│       └─ ui/                  # Button, Modal, Input, SearchSelect(국가), Toast
```

**레이어 규칙**: `app → pages → widgets → features → entities → shared`, `game`은 pages에서만 import. `src/game/`(Phaser)은 Supabase의 존재를 모른다.

---

## 7. 게임↔앱 계약 — 응답 로그 중심

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
  given: string;
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

- 조립 지점(pages/play-survival): 문제·SRS 진행 로드 → 엔진 생성 → Phaser에 주입 → `onEnd`에서 `save-session`.
- 엔진: 방향 뒤집기, 오답 선택지 런타임 생성, **서바이벌은 항상 3지선다**.
- 서바이벌·단어장·복습 세 모드가 같은 엔진을 쓰고, **세 모드의 응답 모두 SRS에 동일 반영한다** (가중치 없음 — 확정).

---

## 8. SRS — SM-2, 2등급

등급은 두 개: **오답 → `again`, 정답 → `good`.**

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

**출제 우선순위** (엔진 내부 전략):

```
1순위  복습 예정: due_at <= now, 오래된 순
2순위  신규: srs_progress 없음, position 순 — 세션당 상한 10 (내부 고정, 설정 없음)
3순위  나머지: due_at 임박순
+ 세션 내 오답은 몇 문항 뒤 재출제 (엔진 내부 큐)
```

**읽기/쓰기 시점**: 플레이 시작 시 1회 조회 → 플레이 중 DB 접근 없음 → 종료 시 히스토리 insert 1회 + SRS upsert 1회. `save-session` 성공 시 관련 쿼리 invalidate → "오늘의 복습" 배지 자동 갱신.

---

## 9. 채점 규칙 (직접입력)

```
1. 복수 표기 분해: 정답 필드를 ';'로 split  ("달리다;뛰다" → ["달리다", "뛰다"])
2. 정규화: trim → 소문자화(영문) → 연속 공백 1칸으로 축약
3. 입력값이 변형 중 하나와 일치하면 정답
```

- 구현: `shared/lib/answer.ts` — `parseVariants(field)`, `normalize(s)`, `isCorrect(given, field)`.
- 선택지 모드에서는 대표 표기만 노출하고, 오답 선택지 생성 시 정답의 모든 변형과 겹치는 항목은 제외.

---

## 10. 랭킹 (확정)

**원칙: 공식 문제집 기록만 집계** (개인 문제집 점수 부풀리기 방지 — RPC 내부에서 `is_official` join으로 강제).

| 랭킹 | 정의 | RPC |
|---|---|---|
| 문제집별 | 해당 공식 문제집에서 유저별 **최고 점수** 순위 | `ranking_by_set(set_id, country?)` |
| 전체 | 유저별 (공식 문제집마다 최고 점수)의 **평균** 순위 + 참여 문제집 수 병기 | `ranking_overall(country?)` |
| 국가 | **국가별 유저 평균점의 평균** + 참여 인원 (국가 대항) | `ranking_by_country()` |

- **합산 → 평균으로 변경한 이유**: 합산은 "많이 깬 사람"이 이기고, 평균은 "잘 깬 사람"이 이긴다. 학습 게임의 취지에는 평균이 맞다. 다만 평균은 문제집 1개만 잘 깬 유저가 상위권에 갈 수 있으므로 **참여 문제집 수를 순위표에 병기**한다 (악용이 보이면 "최소 N개 참여" 조건 추가 — 13절).
- **국가 랭킹도 평균 기준으로 정합**: 합산이면 유저 수 많은 국가가 무조건 이기므로, "국가 내 유저들의 평균점 평균 + 참여 인원"으로 국가 규모와 무관하게 비교한다.
- `country?` 파라미터: 문제집별·전체 랭킹을 "같은 국가끼리"로 필터 (랭킹 페이지의 국가 필터).
- 구현: `security definer` SQL 함수 3개 — 히스토리 RLS를 우회하되 집계 결과(닉네임·국가·점수)만 반환, anon 실행 권한 회수. 전문은 [docs/sql/01-init.sql](../sql/01-init.sql).

### 성능 정책 (확정)

1. **지금: 실시간 RPC 집계로 시작한다.** 인덱스(`play_histories_set_idx` 등)가 받쳐주므로 개인 프로젝트~수천 유저 규모에서는 충분하다. 구현도 제일 단순하다.
2. **전환 기준: `play_histories` 10만 행 초과, 또는 랭킹 RPC 응답이 체감상 느려질 때(약 300ms+).**
3. **전환 방식: materialized view가 아니라 요약 테이블로 간다.**
   `user_set_best (user_id, quiz_set_id, best_score, achieved_at)`를 만들고 `play_histories` insert 트리거로 최고점만 upsert — 랭킹 3종이 전부 이 작은 테이블의 단순 조회가 된다.
   - matview + pg_cron을 채택하지 않는 이유: 갱신 주기만큼 랭킹이 뒤처지고, 스케줄러 관리 부담이 생긴다. 트리거 요약 테이블은 항상 최신이고 관리 대상이 없다.
   - 전환 시 RPC 함수의 내부 쿼리만 교체하면 되므로 **클라이언트는 수정 없음** (RPC 시그니처 유지).

---

## 11. 관리자 (1명)

- 일반 가입 후 SQL로 승격 — 절차는 [docs/sql/03-admin-setup.md](../sql/03-admin-setup.md).
- `admin/sets`: 공식 문제집 목록(국가별) — 수정·삭제, 개인 문제집 검색 후 공식 승격(대상 국가 지정).
- `admin/upload`: 공식 문제집 등록 — CSV/JSON 업로드 + 국가 지정 필수(전체 공통 = null).
- 업로드·수정 UI는 개인용 컴포넌트 재사용, `isOfficial`/`country` 인자만 다름.
- 헤더에 role이 admin일 때만 "관리" 노출 + `RequireAdmin` 가드. 실제 보안 경계는 RLS.

---

## 12. 상태 관리 & 단계별 계획

| 구분 | 예시 | 도구 |
|---|---|---|
| 서버 상태 | 세션·프로필, 문제집, 단어, 히스토리, SRS, 랭킹 | **react-query** (entities api + 쿼리 훅) |
| 클라이언트 상태 (앱) | 선택된 문제집·방식, 모달, 토스트 | **zustand** 얇게 |
| 클라이언트 상태 (게임/세션) | HP·킬수·골드, 응답 로그·재출제 큐 | Phaser 씬 내부 + 엔진 내부 |

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0. Vite 이관** | pnpm + Vite + TS, js/* → `src/game/` ESM 이관, assets 전체 → public/ | 기능 변화 없이 `pnpm dev`로 기존 게임 동작 |
| **1. DB 구축** | [docs/sql](../sql/README.md)의 01-init → 02-seed 실행 | 대시보드에서 테이블·시드 확인 |
| **2. 인증** | 가입(닉네임+국가 검색 select)/로그인 + RequireAuth + 03으로 관리자 승격 | 로그인해야만 로비 진입, 관리자 계정 준비 |
| **3. 읽기 연동** | supabase client + entities + play-quiz 엔진, 서바이벌 퀴즈를 영단어 3지선다로 교체 | 퀴즈가 DB에서 나옴, `quiz-data.js` 삭제 |
| **4. 히스토리** | save-session(히스토리 부분) + result/history 페이지 | 게임 종료 시 기록 저장·조회 |
| **5. 단어장 + 개인 업로드** | play-vocab, 방식 선택, CSV/JSON 업로드, 복수 정답 채점 | 내가 올린 단어장으로 3방식 플레이 |
| **6. 관리자 메뉴** | admin/sets + admin/upload(국가 지정) + 승격 | 공식 문제집이 해당 국가 유저에게 노출 |
| **7. SRS** | features/srs + entities/srs-progress + 복습 모드 + due 배지 | 오답이 빨리, 잘 아는 카드가 늦게 재등장 |
| **8. 랭킹** | entities/ranking + pages/ranking (탭 3개 + 국가 필터) | 문제집별/전체/국가 랭킹 표시 |

### CSV / JSON 업로드 포맷 (5·6단계 공용)

```csv
apple,사과
run,달리다;뛰다
```

```json
{ "title": "중1 영단어",
  "items": [{ "word": "run", "meaning": "달리다;뛰다" }] }
```

---

## 13. 운영하며 조정할 항목 (설계 변경 아님)

- **평균 랭킹의 최소 참여 문제집 수**: 문제집 1개 고득점으로 상위권 독점하는 악용이 보이면 "N개 이상 참여" 조건을 `ranking_overall`에 추가 (참여 수는 이미 병기됨)
- **랭킹 요약 테이블 전환**: 10절의 기준(10만 행 / 300ms) 도달 시 `user_set_best` + 트리거로 교체 — 클라이언트 수정 없음
- **신규 카드 세션 상한(10)·오답 재출제 간격**: 플레이해보고 체감으로 튜닝
