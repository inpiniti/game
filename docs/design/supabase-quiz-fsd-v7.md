# 설계도 v7 — 다국어 단어 학습 게임: Supabase + FSD + SRS + 학습 과학 기법

> ⚠️ **[v8](./supabase-quiz-fsd-v8.md)로 대체됨** — 게임은 서바이벌 하나로 확정(단어장 게임·복습 모드 삭제), 그만하기=죽음, 배치 실시간 해제, 자동 승급 고정.
>
> 작성일: 2026-07-08 · [v6](./supabase-quiz-fsd-v6.md) 대체
>
> **v6 대비 변경점**
> 1. **다국어 콘텐츠 모델** — `quiz_sets.learn_lang` 컬럼 추가: 단어장이 영어단어/일본어단어/중국어단어…로 구분되고, `learn_lang = null`이면 일반 문제/답 문제집. `word`/`meaning`은 **`front`/`back`으로 개칭** (범용 짝 구조)
> 2. **복수 정답 선택지** — 정답 변형이 여러 개면(`anywhere` = `어딘가에;아무데도;어디든지`) 선택지에 정답 변형이 1개~여러 개 섞여 나올 수 있고, **어느 정답 변형을 골라도 정답**. 계약이 `correctIndex` → `correctIndices[]`로 변경
>
> 유지: 기술 스택 A안, 로그인 필수, 공식(관리자 1명·국가별)/개인 이원화, SRS 2등급 + 배치 해제 + 5턴 쿨다운, 자동 모드(재인→회상), 예문, 취약 단어, 랭킹 요약 테이블(user_set_best), 국가 전체 목록, docs/sql 운영

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
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. 기존 `assets/` 전체 → `public/assets/`.

---

## 2. 콘텐츠 모델 — 다국어 짝(front/back) 구조

### 2-1. 문제집 종류: 학습 언어로 구분

문제집(`quiz_sets`)에 **`learn_lang`**(학습 언어) 컬럼을 둔다:

| `learn_lang` | 의미 | 목록 표시 | 플레이 규칙 |
|---|---|---|---|
| `en` / `ja` / `zh` … | 단어장 (해당 언어) | "영어단어", "일본어단어", "중국어단어" 탭 | 방향 뒤집기 O, 직접입력 O, 자동 모드 O |
| `null` | 일반 문제/답 | "일반" 탭 | **front→back 고정**, 선택지 모드 위주 |

- **뜻(back)의 언어는 컬럼이 필요 없다** — 공식 문제집은 이미 `country`가 있어서 "KR 대상 일본어단어장 = 뜻이 한국어"가 자동 성립한다. 유저는 자기 국가 대상 문제집만 보므로 뜻은 항상 모국어다.
- 언어 코드↔표시명 매핑은 `shared/config/languages.ts` (`{ code, nameKo }`, 필요한 언어만 등록하고 늘려감).
- 일반 문제집에서 방향 뒤집기·직접입력을 막는 이유: "십계명은 몇 개?" ↔ "10개"를 뒤집으면 문제가 성립하지 않고, 긴 답 입력은 채점이 어색하다. 문제집 성격에 따라 엔진 옵션만 분기한다.

### 2-2. 단어(항목) 구조: front / back

`quiz_items`의 `word`/`meaning`을 **`front`/`back`으로 개칭**한다 — 구조는 동일하고 이름만 범용화.

- 단어장: `front` = 학습 언어 단어, `back` = 모국어 뜻
- 일반: `front` = 문제, `back` = 답
- **복수 표기**: `front`·`back` 모두 `;` 구분 (예: `anywhere` / `어딘가에;아무데도;어디든지`). 첫 항목이 대표 표기.
- **예문 `example`**(선택): 정답 공개 직후 표시 (v6과 동일).

### 2-3. 공식/개인 이원화 (v6과 동일)

| | 공식 문제집 | 개인 문제집 |
|---|---|---|
| 등록 | **관리자만** (국가 + 언어/일반 지정) | 로그인 유저 누구나 |
| 플레이 | 자기 국가 대상 (+ 국가 공통) | 본인만 |
| 수정/삭제 | 관리자 | 본인 |

권한 매트릭스·게스트 불가(전역 `RequireAuth`)·국가 처리(ISO 전체, UTC 저장)는 v5~v6과 동일.

---

## 3. 복수 정답 선택지 (신규)

영어 단어는 품사에 따라 뜻이 여러 개인 경우가 많다. 직접입력은 이미 어느 변형이든 정답 처리하지만(v4~), **선택지 모드도 복수 정답을 자연스럽게 다뤄야 한다.**

### 선택지 생성 규칙

```
V = 정답 필드의 변형 목록          예: anywhere → [어딘가에, 아무데도, 어디든지]
k = random(1 .. min(|V|, N))       N = 선택지 수 (기본 3)
선택지 = V에서 무작위 k개 + 오답 (N - k)개, 순서 셔플
오답 후보 = 같은 문제집 다른 항목의 back(또는 front) 대표 표기
           단, 정규화했을 때 정답 변형 중 하나와 일치하는 것은 제외
채점 = 클릭한 선택지가 정답 변형이면 정답
```

`anywhere`의 예 (N=3):

| k | 선택지 예 | 채점 |
|---|---|---|
| 1 | 아무데도 / 오답 / 오답 | 아무데도만 정답 |
| 2 | 어딘가에 / 아무데도 / 오답 | 둘 중 아무거나 정답 |
| 3 | 어딘가에 / 아무데도 / 어디든지 | 전부 정답 (보너스 문항처럼 동작) |

- k가 무작위라서 같은 단어도 매번 다른 조합으로 나온다 — "이 단어는 뜻이 여러 개"라는 것 자체가 학습된다.
- **DB 변경은 없다.** `back`에 이미 `;` 변형이 저장돼 있으므로 순수하게 엔진(선택지 생성)과 계약(아래) 변경.
- 방향을 뒤집은 경우(한→영)도 대칭으로 동작한다 (`color;colour`처럼 front에 변형이 있으면 동일 규칙).
- 문제 지문(prompt)은 항상 **대표 표기(첫 변형)**만 보여준다 — 변형 전체를 지문에 노출하면 답을 흘리게 됨.

---

## 4. 도메인 모델

```
quiz_sets (learn_lang, country) 1 ─── * quiz_items (front/back/example)
    │                                        │
auth.users 1 ── 1 profiles (nickname, country, role)
     │                                        │
     ├────── * play_histories * ── 1 quiz_sets    (한 판 단위)
     ├────── * srs_progress   * ── 1 quiz_items   (카드 한 장 단위)
     └────── * user_set_best  * ── 1 quiz_sets    (랭킹 요약: 최고점 1행, 트리거 유지)
```

| 도메인 | 테이블 | v7 변경 |
|---|---|---|
| 유저 | `profiles` | — |
| 문제집 | `quiz_sets` | **+ `learn_lang`** (null = 일반) |
| 항목 | `quiz_items` | **`word`/`meaning` → `front`/`back`** |
| 히스토리 | `play_histories` | — |
| 학습 진행 | `srs_progress` | — |
| 랭킹 요약 | `user_set_best` | — |

---

## 5. DB 스키마

**실행용 전체 SQL은 [docs/sql/01-init.sql](../sql/01-init.sql)이 단일 기준.** 구조 요점:

```sql
profiles       (id, nickname, country, role, created_at)
quiz_sets      (id, title, user_id nullable, is_official, country nullable,
                learn_lang nullable,   -- ★ 'en'/'ja'/'zh'... , null = 일반 문제/답
                created_at)
quiz_items     (id, quiz_set_id, position, front, back, example nullable, created_at)
play_histories (id, user_id, quiz_set_id, game_type, settings, score,
                correct_count, total_count, wrong_items, played_at)
srs_progress   (user_id, quiz_item_id) pk, ease_factor, interval_days, repetition,
                lapses, due_at, last_reviewed_at
user_set_best  (user_id, quiz_set_id) pk, best_score, achieved_at   -- 트리거 유지
```

RLS·트리거·랭킹 RPC 3종(요약 테이블 조회, 평균 기준)은 v6과 동일 — `learn_lang`은 보안 사안이 아니라 조회 필터일 뿐이므로 RLS 변경 없음.

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
│   │   ├─ quiz-set-list/       # ★ 탭: 언어별(영어단어/일본어단어/…/일반) × [공식|내 것]
│   │   ├─ play-survival/  play-vocab/  review/  result/  history/  ranking/
│   │   └─ admin/               # sets(목록·승격) / upload(국가 + 언어/일반 지정)
│   ├─ widgets/
│   │   ├─ header/  quiz-set-grid/  due-today/  ranking-table/  history-table/  weak-words/
│   │   └─ game-mode-panel/     # 방향 + 방식 — 일반 문제집이면 방향·입력 옵션 숨김
│   ├─ features/
│   │   ├─ auth/  upload-quiz-set/  manage-quiz-set/  save-session/
│   │   ├─ play-quiz/           # 출제 엔진: 복수 정답 선택지·배치 해제·쿨다운·방식 승급
│   │   └─ srs/                 # SM-2 계산(2등급) + 출제 우선순위 전략
│   ├─ entities/
│   │   ├─ user/  quiz-set/     # quiz-set api: officialList(country, learnLang?)
│   │   ├─ quiz-item/  history/  ranking/  srs-progress/
│   ├─ game/                    # Phaser 영역 — FSD 밖, pages만 import, Supabase 모름
│   └─ shared/
│       ├─ api/supabase.ts
│       ├─ config/countries.ts  # ISO 전체 { code, nameKo, nameEn, tz }
│       ├─ config/languages.ts  # ★ 학습 언어 { code, nameKo } — en/ja/zh부터 시작
│       ├─ lib/                 # csv 파서, shuffle, answer(변형 파싱·정규화·채점)
│       └─ ui/
```

**레이어 규칙**: `app → pages → widgets → features → entities → shared`, `game`은 pages에서만 import.

---

## 7. 게임↔앱 계약 — 복수 정답 반영

```ts
// features/play-quiz/model/types.ts
export interface QuizQuestion {
  itemId: string;
  prompt: string;             // 출제 방향에 따라 front 또는 back의 대표 표기
  mode: 'choice' | 'input';   // 자동 모드에서는 카드 학습 단계에 따라 결정
  choices: string[];          // choice 모드만 (input이면 빈 배열)
  correctIndices: number[];   // ★ 정답 선택지 인덱스 목록 (1개 이상) — 복수 정답
  answer: string;             // 정답 대표 표기 — 피드백 표시용
  example?: string;           // 예문 — 정답 공개 직후 표시
}

export interface AnswerLog { itemId: string; given: string; correct: boolean; }

export interface QuizSource {
  next(): QuizQuestion;
  report(log: AnswerLog): void;
}

export interface GameResult { score: number; answers: AnswerLog[]; }
```

- **선택지 채점**: 클릭 인덱스 ∈ `correctIndices` → 정답. 오답 클릭 시 정답 강조는 `correctIndices` 전부에 표시.
- **직접입력 채점**: `shared/lib/answer.isCorrect(given, field)` — 변형 중 하나와 정규화 일치 (v4~ 동일).
- 서바이벌은 항상 `choice`(3지선다). 세 모드 응답 모두 SRS에 동일 반영.
- Phaser 쪽 변경: `SurvivalScene.showQuiz()`의 정답 판정을 `i === correctIndex`에서 `correctIndices.includes(i)`로 — 그 외 동일.

---

## 8. SRS와 출제 규칙 (v6과 동일)

- **SM-2, 2등급**: 오답 → `again`(리셋·EF−0.2·lapses+1·10분 뒤), 정답 → `good`(1일 → 6일 → ×EF).
- **신규 카드 배치 해제**: position 순 10개 묶음. 노출된 신규 중 repetition=0이 남아 있으면 새 배치를 열지 않고, 전원 1회 이상 정답이면 다음 판부터 다음 10개 해제 (판정은 세션 시작 시).
- **출제 순서**: due 오래된 순 → 현재 배치 미학습 신규 → 나머지 due 임박순.
- **오답 재출제**: 랜덤 복귀하되 직후 5턴 쿨다운.
- **쓰기 시점**: 종료 시 히스토리 insert 1회 + SRS upsert 1회 (`user_set_best`는 트리거 자동).

---

## 9. 학습 과학 기법 (v6과 동일 + 복수 정답의 학습 효과)

- **재인→회상 자동 승급 (기본 모드)**: repetition 0~1 → 선택지, ≥ 2 → 직접입력. 단, **일반 문제집(learn_lang = null)은 선택지 고정**.
- **맥락 부호화**: `example`을 정답 공개 직후 노출.
- **취약 단어(leech)**: lapses ≥ 8 → 복습 페이지 취약 단어 섹션 (정독 후 재도전).
- **복수 정답 선택지의 효과**: 같은 단어가 매번 다른 정답 변형 조합으로 출제되어, 대표 뜻 하나만 기계적으로 외우는 것을 막고 뜻의 폭을 함께 학습시킨다 (3절).

---

## 10. 랭킹 (v6과 동일)

`user_set_best` 요약 테이블(트리거 유지, 공식 문제집만) + `security definer` RPC 3종: 문제집별 최고점 / 전체 **평균**(참여 문제집 수 병기) / 국가별 유저 평균의 평균. 히스토리가 커져도 랭킹 비용 불변, 클라이언트는 트리거 존재를 모름.

---

## 11. 관리자 (1명, v6과 동일 + 언어 지정)

일반 가입 후 [docs/sql/03-admin-setup.md](../sql/03-admin-setup.md)로 승격.
`admin/upload`: CSV/JSON + **국가 지정 + 언어/일반 지정**(learn_lang). `admin/sets`: 목록(국가·언어 필터)·수정·삭제·개인 승격.

---

## 12. 상태 관리 & 단계별 계획

상태 관리는 v6과 동일 (react-query / zustand / 씬·엔진 내부).

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0. Vite 이관** | pnpm + Vite + TS, js/* → `src/game/`, assets → public/ | 기존 게임 동작 |
| **1. DB 구축** | [docs/sql](../sql/README.md) 01-init(learn_lang·front/back·요약 테이블 포함) → 02-seed | 테이블·시드 확인 |
| **2. 인증** | 가입(닉네임+국가)/로그인 + RequireAuth + 관리자 승격 | 로그인해야 로비 진입 |
| **3. 읽기 연동** | supabase client + entities + 엔진(복수 정답 선택지 포함), 서바이벌 퀴즈 교체 | 퀴즈가 DB에서, `quiz-data.js` 삭제 |
| **4. 히스토리** | save-session + result/history | 기록 저장·조회 |
| **5. 단어장 + 개인 업로드** | play-vocab, 방식 4종(자동), CSV/JSON(예문 3열), 언어 탭 목록 | 내 단어장으로 플레이 |
| **6. 관리자 메뉴** | admin/sets + admin/upload(국가+언어) + 승격 | 공식 문제집 국가·언어별 노출 |
| **7. SRS** | 배치 해제 + 쿨다운 + 복습 모드 + due 배지 + 취약 단어 | 배치 진행·오답 우선 재등장 |
| **8. 랭킹** | entities/ranking + pages/ranking | 문제집별/전체/국가 랭킹 |

### CSV / JSON 업로드 포맷 (`front,back[,example]` — 변형은 `;`)

```csv
anywhere,어딘가에;아무데도;어디든지,You can sit anywhere.
run,달리다;뛰다,I run every morning.
book,책
```

```json
{ "title": "중1 영단어", "learnLang": "en",
  "items": [{ "front": "anywhere", "back": "어딘가에;아무데도;어디든지",
              "example": "You can sit anywhere." }] }
```

---

## 13. 운영하며 조정할 항목 (설계 변경 아님 — 상수 튜닝)

- **정답 변형 출제 개수 k의 분포**: 현재 균등 랜덤(1~min(|V|,N)) — "전부 정답" 문항이 너무 잦으면 k 상한을 N−1로 제한
- **배치 크기(10)·해제 기준(전원 repetition ≥ 1)** / **오답 쿨다운(5턴, 소형 문제집 완화 포함)**
- **자동 모드 승급 기준(repetition ≥ 2)** / **취약 단어 기준(lapses ≥ 8)**
- **평균 랭킹 최소 참여 문제집 수** / **승격 시 랭킹 백필**
- **발음 듣기(TTS)**: Web Speech API — learn_lang이 있으니 언어별 음성 선택도 가능
