# 설계도 v6 — 영단어 학습 게임: Supabase + FSD + SRS + 학습 과학 기법

> ⚠️ **[v7](./supabase-quiz-fsd-v7.md)로 대체됨** — 다국어(learn_lang + front/back 범용화), 복수 정답 선택지(correctIndices).
>
> 작성일: 2026-07-08 · [v5](./supabase-quiz-fsd-v5.md) 대체
>
> **v5 대비 변경점**
> 1. **랭킹 요약 테이블 즉시 도입** — "나중에 전환"이 아니라 처음부터 `user_set_best` + insert 트리거. 랭킹 RPC는 이 작은 테이블만 조회
> 2. **신규 카드: 세션 상한 → 배치 해제 방식** — 10개 배치를 먼저 학습하고, 배치 전체가 최소 1회 정답이 되면 다음 10개 해제 (호흡이 긴 게임에 맞춤)
> 3. **오답 재출제: 랜덤 + 최소 5턴 쿨다운** — 틀린 직후 5문항 안에는 재등장 금지
> 4. **타이밍(SRS) 외의 학습 과학 기법 추가** (9절): 재인→회상 자동 승급(기본 모드), 예문 맥락(`example` 컬럼), 취약 단어(leech) 관리
>
> 유지: 기술 스택 A안, 영단어 전용, 로그인 필수, 공식(관리자 1명·국가별)/개인 문제집 이원화, SRS 2등급(SM-2), 복수 정답 `;`, 국가 전체 목록, 랭킹 평균 기준, docs/sql 운영

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
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- 기존 `assets/` 전체를 Vite `public/assets/`로 이동.

---

## 2. 콘텐츠 모델

문제는 전부 **영단어 짝(`word` / `meaning`) + 선택적 예문(`example`)**.
방향(영→한/한→영)과 방식은 플레이 시점 설정, 선택지는 같은 문제집의 다른 항목에서 런타임 생성.

- **복수 표기**: `word`·`meaning` 모두 `;` 구분 (예: `run` / `달리다;뛰다`). 첫 항목이 대표 표기, 직접입력 채점은 어느 변형이든 정답.
- **예문**: 선택 입력. 정답 공개 직후 노출해 단어를 맥락으로 부호화한다 (9절).

| | 공식 문제집 | 개인 문제집 |
|---|---|---|
| 등록 | **관리자만** (국가 지정 필수) | 로그인 유저 누구나 |
| 플레이 | 자기 국가 대상 (+ 국가 공통) | 본인만 |
| 수정/삭제 | 관리자 | 본인 |
| 구현 | `is_official = true`, `country` 지정 | `is_official = false`, `user_id = 본인` |

권한 매트릭스·게스트 불가(전역 `RequireAuth`)는 v5와 동일.

---

## 3. 국가 처리 (v5와 동일)

- `shared/config/countries.ts`에 ISO 3166-1 alpha-2 **전체(약 249개국)**: `{ code, nameKo, nameEn, tz }`. 다중 시간대 국가는 대표 1개. 가입 폼은 검색형 select, 기본값 KR.
- 모든 시각은 UTC 저장·비교. 국가는 ① 공식 문제집 필터 ② 날짜 표시 ③ 국가 랭킹에만 사용.

---

## 4. 도메인 모델

```
quiz_sets 1 ─── * quiz_items
    │                │
auth.users 1 ── 1 profiles (nickname, country, role)
     │               │
     ├────── * play_histories * ── 1 quiz_sets    (한 판 단위)
     ├────── * srs_progress   * ── 1 quiz_items   (카드 한 장 단위)
     └────── * user_set_best  * ── 1 quiz_sets    (★ 랭킹 요약: 유저×문제집 최고점 1행)
```

| 도메인 | 테이블 | 설명 |
|---|---|---|
| 유저 | `profiles` | 닉네임 + 국가 + role |
| 문제집 | `quiz_sets` | 제목, 등록자, `is_official`, `country` |
| 단어 | `quiz_items` | `word`/`meaning`(`;` 복수 표기) + **`example`(예문, 선택)** |
| 히스토리 | `play_histories` | 한 판의 결과 (불변 기록) |
| 학습 진행 | `srs_progress` | 유저×단어 SRS 상태 — **취약 단어 판정(lapses)도 여기서** |
| **랭킹 요약** | **`user_set_best`** | **트리거가 자동 유지하는 유저×공식문제집 최고점** |

---

## 5. DB 스키마

**실행용 전체 SQL은 [docs/sql/01-init.sql](../sql/01-init.sql)이 단일 기준.** 구조 요점:

```sql
profiles       (id, nickname, country, role, created_at)
quiz_sets      (id, title, user_id nullable, is_official, country nullable, created_at)
quiz_items     (id, quiz_set_id, position, word, meaning, example nullable, created_at)
play_histories (id, user_id, quiz_set_id, game_type, settings, score,
                correct_count, total_count, wrong_items, played_at)
srs_progress   (user_id, quiz_item_id) pk, ease_factor, interval_days, repetition,
                lapses, due_at, last_reviewed_at
user_set_best  (user_id, quiz_set_id) pk, best_score, achieved_at   -- ★ 트리거 유지
```

**`user_set_best` 동작**: `play_histories`에 insert가 일어나면 트리거가 ① 공식 문제집 기록인지 확인하고 ② 기존 최고점보다 높을 때만 upsert한다. 몇 판을 하든 유저×문제집당 1행 — 랭킹 3종이 전부 이 테이블의 단순 조회가 되어 **유저가 늘어도 랭킹이 느려지지 않는다**. 클라이언트는 트리거의 존재를 모른다(히스토리만 insert).

**RLS 요점**: 전 테이블 `to authenticated`(anon 없음). 문제집/단어는 공식 or 본인, 쓰기는 개인=본인·공식=`is_admin()`. `profiles`는 `nickname`·`country` 컬럼만 본인 수정(role 자가 승격 차단). 히스토리·SRS·요약은 본인 것만 읽기 — 타인 기록은 랭킹 RPC(집계 결과만 반환)로만 노출.

---

## 6. FSD 폴더 구조

```
game/
├─ docs/ (design, sql)
├─ public/assets/
├─ src/
│   ├─ app/                     # main, providers, router(RequireAuth/RequireAdmin), styles
│   ├─ pages/
│   │   ├─ login/               # 가입: 닉네임 + 국가 검색형 select
│   │   ├─ lobby/               # 게임 선택 + "오늘의 복습" 배지
│   │   ├─ quiz-set-list/       # 탭: [공식(내 국가+공통)] [내 문제집(+업로드)]
│   │   ├─ play-survival/       # Phaser 마운트 (데이터 주입)
│   │   ├─ play-vocab/          # 단어장 게임 (React)
│   │   ├─ review/              # SRS 복습 세션 + ★ 취약 단어 섹션
│   │   ├─ result/              # 결과 + 히스토리·SRS 저장 트리거
│   │   ├─ history/
│   │   ├─ ranking/             # 탭: 문제집별 / 전체 / 국가 (+ 국가 필터)
│   │   └─ admin/               # sets(목록·승격) / upload(국가 지정)
│   ├─ widgets/
│   │   ├─ header/  quiz-set-grid/  due-today/  ranking-table/  history-table/
│   │   ├─ game-mode-panel/     # 방향 + 방식(★자동/N지선다/직접입력/랜덤)
│   │   └─ weak-words/          # ★ 취약 단어(leech) 목록
│   ├─ features/
│   │   ├─ auth/  upload-quiz-set/  manage-quiz-set/  save-session/
│   │   ├─ play-quiz/           # 출제 엔진: 배치 해제·쿨다운·방식 승급·채점·응답 로그
│   │   └─ srs/                 # SM-2 계산(2등급) + 출제 우선순위 전략
│   ├─ entities/
│   │   ├─ user/  quiz-set/  quiz-item/  history/  ranking/
│   │   └─ srs-progress/        # + 취약 단어(lapses 기준) 조회
│   ├─ game/                    # Phaser 영역 — FSD 밖, pages만 import, Supabase 모름
│   │   ├─ survival/ (SurvivalScene, MainScene, upgrades, index)
│   │   └─ assets-manifest.ts
│   └─ shared/
│       ├─ api/supabase.ts  config/countries.ts
│       ├─ lib/                 # csv 파서, shuffle, answer(복수표기·정규화·채점)
│       └─ ui/                  # Button, Modal, Input, SearchSelect, Toast
```

**레이어 규칙**: `app → pages → widgets → features → entities → shared`, `game`은 pages에서만 import.

---

## 7. 게임↔앱 계약

자동 모드(문항마다 선택/입력이 달라짐)와 예문 표시를 위해 `QuizQuestion`이 확장됐다.

```ts
// features/play-quiz/model/types.ts
export interface QuizQuestion {
  itemId: string;
  prompt: string;             // 방향에 따라 word 또는 meaning의 대표 표기
  mode: 'choice' | 'input';   // ★ 자동 모드에서는 카드 학습 단계에 따라 결정됨
  choices: string[];          // choice 모드만 (input이면 빈 배열)
  correctIndex: number;       // choice 모드만
  answer: string;             // 정답 대표 표기 — 정답 공개·input 피드백용
  example?: string;           // ★ 예문 — 정답 공개 직후 표시
}

export interface AnswerLog { itemId: string; given: string; correct: boolean; }

export interface QuizSource {
  next(): QuizQuestion;
  report(log: AnswerLog): void;   // 응답 통지 (쿨다운 큐·배치 상태 갱신)
}

export interface GameResult { score: number; answers: AnswerLog[]; }
```

- 직접입력 채점은 UI가 `shared/lib/answer.isCorrect(given, field)`로 판정 후 `report()`.
- 서바이벌은 항상 `choice`(3지선다) — 게임 템포상 입력 부적합. 세 모드(서바이벌/단어장/복습)의 응답 모두 SRS에 **동일 반영**.
- 조립 지점(pages/play-survival)은 v5와 동일: 로드 → 엔진 생성 → 주입 → `onEnd`에서 save-session.

---

## 8. SRS와 출제 규칙

### 8-1. SM-2, 2등급 (v5와 동일)

오답 → `again`(interval 리셋, EF −0.2, lapses+1, 10분 뒤 due), 정답 → `good`(1일 → 6일 → interval×EF).

### 8-2. 신규 카드 — 배치 해제 방식 (변경)

이 게임은 호흡이 길다. 신규 단어를 세션마다 흘리는 대신 **10개 묶음(배치)을 떼고 가는** 방식으로 한다.

```
배치 = position 순 10개 묶음.
세션 시작 시 판정:
  노출된 신규 카드(progress 있음) 중 repetition = 0 (아직 1회도 정답 없음)이 하나라도 남아 있으면
    → 새 배치를 열지 않는다. 이번 세션의 신규는 그 미학습 카드들뿐.
  전부 repetition ≥ 1 이면
    → 다음 position 순 10개를 신규로 해제.
```

- "어느 정도 학습됨"의 기준 = **배치 전원 최소 1회 정답** (상수이므로 튜닝 가능 — 14절).
- 판정은 **세션 시작 시** 서버 데이터 기준. 세션 도중에는 해제하지 않는다 (다음 판부터).
- 100단어 문제집 예: 첫 판은 1~10번만 신규로 등장 → 10개를 다 한 번씩 맞히고 나면 다음 판부터 11~20번 등장.

### 8-3. 출제 우선순위와 오답 재출제 (변경)

```
출제 순서: ① due 오래된 순 → ② 현재 배치의 미학습 신규 → ③ 나머지 due 임박순
오답 재출제: 오답 카드는 출제 후보 풀에 복귀하되,
            직후 5턴 안에는 재등장 금지(쿨다운 5) — 그 외 시점은 랜덤.
```

- 쿨다운을 두는 이유: 틀린 직후 바로 다시 내면 방금 본 답을 단기 기억으로 찍게 되어 학습 효과가 없다. 5턴 뒤에는 인출 노력이 필요해진다.

### 8-4. 읽기/쓰기 시점 (v5와 동일)

플레이 시작 시 1회 조회 → 플레이 중 DB 접근 없음 → 종료 시 히스토리 insert 1회 + SRS upsert 1회 (`user_set_best`는 DB 트리거가 자동 처리). `save-session` 성공 시 관련 쿼리 invalidate.

---

## 9. SRS를 넘어서 — 적용하는 학습 과학 기법

라이트너/Anki류 SRS는 "**언제** 복습할 것인가"만 다룬다. v6은 "**어떻게** 인출할 것인가"까지 설계에 넣는다.

**이미 게임 구조에 내장된 것**: 인출 연습(테스팅 효과 — 보기만 하는 것보다 꺼내보는 게 강함), 간격 반복(SM-2), 즉각 피드백(정답 즉시 공개), 인터리빙(단어가 섞여서 출제됨).

**v6에서 추가 채택하는 것 3가지:**

### ① 재인 → 회상 승급 (자동 모드 — 기본값)

선택지에서 고르기(재인, recognition)보다 직접 떠올려 쓰기(회상, recall)가 기억을 훨씬 강하게 만든다. 다만 처음 보는 단어에 입력을 시키면 좌절만 준다. → **카드의 학습 단계에 따라 방식을 자동 승급**한다.

```
repetition 0~1  → 선택지 모드 (재인으로 진입 장벽 낮춤)
repetition ≥ 2  → 직접입력 모드 (회상으로 강화 — '바람직한 어려움')
```

- 방식 선택지: **자동(기본값)** / N지선다 / 직접입력 / 랜덤 — 수동 모드는 유지.
- 서바이벌은 예외적으로 항상 선택지 (7절).

### ② 맥락 부호화 — 예문

단어를 고립된 짝이 아니라 문장 맥락과 함께 저장하면 부호화가 깊어진다(정교화). `quiz_items.example`(선택)을 두고 **정답 공개 직후 예문을 노출**한다 — 문제에 미리 보여주면 힌트가 되므로 피드백 단계에서만.

- CSV 3열(선택): `run,달리다;뛰다,I run every morning.`
- 예문이 없는 단어는 그냥 생략 (강제 아님).

### ③ 취약 단어(leech) 관리

몇 번을 반복해도 안 외워지는 단어는 SRS가 해결 못 한다 — 무한 재출제로 시간만 먹는다(Anki의 leech 문제). `srs_progress.lapses`(누적 오답)가 이미 있으므로:

```
lapses ≥ 8  →  '취약 단어'로 표시
```

- `widgets/weak-words`: 복습 페이지에 취약 단어 섹션 — 단어·뜻·예문을 **학습 모드로 정독**(출제가 아니라 다시 보기)한 뒤 재도전.
- 출제에서 제외하지는 않는다(Anki는 suspend하지만, 게임에서는 노출 유지가 자연스러움). 기준값 8은 튜닝 항목.

**검토했지만 당장 안 하는 것**: 이미지 연상(dual coding — 단어별 이미지 에셋 필요), 키워드 연상법(자동 생성 곤란), 발음 듣기(Web Speech API TTS로 저비용 가능 — 14절 후보).

---

## 10. 채점 규칙 (직접입력, v5와 동일)

`;` 분해 → 정규화(trim·소문자·공백 축약) → 변형 중 하나와 일치하면 정답.
구현: `shared/lib/answer.ts`. 선택지 생성 시 정답의 모든 변형과 겹치는 오답 후보는 제외.

---

## 11. 랭킹 — 요약 테이블 기반 (변경: 즉시 도입)

**원칙: 공식 문제집 기록만 집계** — `user_set_best` 트리거가 insert 시점에 공식 여부를 확인하므로 애초에 요약에 개인 기록이 들어가지 않는다.

| 랭킹 | 정의 | RPC |
|---|---|---|
| 문제집별 | 유저별 최고 점수 순위 | `ranking_by_set(set_id, country?)` |
| 전체 | 유저별 (문제집별 최고점)의 **평균** + 참여 문제집 수 병기 | `ranking_overall(country?)` |
| 국가 | 국가별 유저 평균점의 평균 + 참여 인원 | `ranking_by_country()` |

- 세 RPC 모두 `user_set_best`(유저×문제집당 1행)만 조회 — `play_histories`가 수백만 행이 되어도 랭킹 비용은 그대로. v5의 "10만 행 도달 시 전환" 정책은 폐기(전환할 일 자체가 없어짐).
- 평균 채택 이유(v5와 동일): "많이 깬 사람"이 아니라 "잘 깬 사람"이 이긴다. 국가 랭킹도 평균으로 국가 규모 보정.
- `security definer` 함수로 집계 결과(닉네임·국가·점수)만 노출, anon 실행 회수.
- **주의**: 개인 문제집이 공식으로 승격되면 승격 이후 기록부터 랭킹에 반영된다 (이전 기록 백필은 하지 않음 — 필요해지면 승격 시 1회성 백필 쿼리 추가, 14절).

---

## 12. 관리자 (1명, v5와 동일)

일반 가입 후 [docs/sql/03-admin-setup.md](../sql/03-admin-setup.md)로 승격. `admin/sets`(목록·수정·삭제·개인 승격), `admin/upload`(국가 지정 필수). 실제 보안 경계는 RLS의 `is_admin()`.

---

## 13. 상태 관리 & 단계별 계획

| 구분 | 예시 | 도구 |
|---|---|---|
| 서버 상태 | 세션·프로필, 문제집, 단어, 히스토리, SRS, 랭킹 | **react-query** |
| 클라이언트 상태 (앱) | 선택된 문제집·방식, 모달, 토스트 | **zustand** 얇게 |
| 클라이언트 상태 (게임/세션) | HP·킬수, 응답 로그·쿨다운 큐·배치 상태 | Phaser 씬 + 엔진 내부 |

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0. Vite 이관** | pnpm + Vite + TS, js/* → `src/game/`, assets → public/ | 기능 변화 없이 기존 게임 동작 |
| **1. DB 구축** | [docs/sql](../sql/README.md) 01-init(요약 테이블·트리거 포함) → 02-seed | 테이블·시드 확인 |
| **2. 인증** | 가입(닉네임+국가)/로그인 + RequireAuth + 관리자 승격 | 로그인해야 로비 진입 |
| **3. 읽기 연동** | supabase client + entities + 엔진(선택지 생성), 서바이벌 퀴즈 교체 | 퀴즈가 DB에서, `quiz-data.js` 삭제 |
| **4. 히스토리** | save-session + result/history (user_set_best는 트리거가 자동) | 기록 저장·조회 |
| **5. 단어장 + 개인 업로드** | play-vocab, 방식 4종(자동 포함), CSV/JSON(예문 3열), 복수 정답 채점, 예문 피드백 | 내 단어장으로 플레이 |
| **6. 관리자 메뉴** | admin/sets + admin/upload + 승격 | 공식 문제집 국가별 노출 |
| **7. SRS** | features/srs + 배치 해제 + 쿨다운 + 복습 모드 + due 배지 + 취약 단어 | 배치 진행·오답 우선 재등장 확인 |
| **8. 랭킹** | entities/ranking + pages/ranking | 문제집별/전체/국가 랭킹 표시 |

### CSV / JSON 업로드 포맷 (예문 3열은 선택)

```csv
apple,사과,She ate an apple.
run,달리다;뛰다,I run every morning.
book,책
```

```json
{ "title": "중1 영단어",
  "items": [{ "word": "run", "meaning": "달리다;뛰다", "example": "I run every morning." }] }
```

---

## 14. 운영하며 조정할 항목 (설계 변경 아님 — 상수 튜닝)

- **배치 크기(10)·해제 기준(전원 repetition ≥ 1)**: 플레이 체감으로 조정 (예: 80% 정답 시 해제)
- **오답 쿨다운(5턴)**: 문제집이 작으면(10단어 이하) 쿨다운이 출제를 막을 수 있음 — 후보 부족 시 쿨다운 완화 로직 포함
- **자동 모드 승급 기준(repetition ≥ 2)** / **취약 단어 기준(lapses ≥ 8)**
- **평균 랭킹 최소 참여 문제집 수**: 악용 보이면 `ranking_overall`에 "N개 이상" 조건 추가
- **승격 시 랭킹 백필**: 개인→공식 승격 시 기존 기록 반영이 필요해지면 1회성 백필 쿼리
- **발음 듣기(TTS)**: Web Speech API로 저비용 추가 가능 — 정답 공개 시 단어 읽어주기 후보
