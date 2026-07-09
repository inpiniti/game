# 설계도 v9 — 딸기 서바이벌 (ddalki-survival): 다국어 도입

> 작성일: 2026-07-08 · [v8](./supabase-quiz-fsd-v8.md) 대체 · 게임명: **딸기 서바이벌** (영문 `ddalki-survival`, 🍓)
>
> **v8 대비 변경점 — 다국어(i18n) 도입** (상세: [features/2026-07-08_i18n.md](../features/2026-07-08_i18n.md))
> 1. **언어 3개념 분리** — 국가(`profiles.country`, 랭킹용) / 학습 언어(`quiz_sets.learn_lang`, 문제집) / **UI 언어(신규, localStorage)**. 국가 ≠ UI 언어 — 국가는 기본값 힌트일 뿐, 명시 선택이 항상 이긴다
> 2. **UI 언어 결정**: 명시 선택(localStorage) → 국가 매핑 → 브라우저 언어 → en. 지원: ko(원문)·en·ja
> 3. **i18next + react-i18next** — `shared/i18n/`에 배치, 커스텀 resolve. 게임 내 텍스트는 브리지로 **번역 사전 주입** (`src/game/`은 i18n을 모른다)
> 4. **스키마 무변경** — `profiles.ui_lang` 컬럼 없음(1차). 언어 전환 UI는 프로필 바텀시트에 row 1개 추가
> 5. 문서 운영 변경: 이후 기능 추가는 기준 문서 버전업 대신 **`docs/features/` 델타 문서**로 기록, 델타가 쌓이면 통합 버전업
>
> 유지: v8의 게임 모델 전부 — 단일 서바이벌 게임, 종료=죽음, 실시간 배치 해제, 자동 승급(3지선다→직접입력), 보이지 않는 SRS, 기술 스택 A안, 공식/개인 이원화, docs/sql 운영

---

## 1. 게임 정의 (한 문단)

**딸기 서바이벌**은 뱀서라이크 서바이벌 게임이다. 몬스터를 피하고 잡다가 금화를 먹으면 퀴즈가 뜬다. 퀴즈를 맞히면 강해지고(업그레이드 보상), 틀리면 아무것도 없다. 퀴즈는 관리자/유저가 올린 단어장에서 나온다. 죽으면 게임오버 — 점수가 기록되고 랭킹에 반영된다. **목적은 게임을 하다 보면 저절로 단어가 외워지는 것**이다. 그냥 외우면 재미없으니 게임과 랭킹으로 감싼 것.

```
플레이 → 몬스터 처치·금화 획득 → 퀴즈 (단어장 기반)
                                    ├─ 정답 → 축복(업그레이드) → 더 강해짐
                                    └─ 오답 → 보상 없음 (단어는 나중에 다시 나옴)
죽음(또는 일시정지→그만하기) → 게임오버 → 기록 저장 → 결과 화면 → 랭킹
```

---

## 2. 기술 스택 (확정)

**Vite + React + TypeScript 셸 안에 Phaser를 마운트한다.**

- React(셸): 로그인/가입, 로비, 문제집 선택·상세, 결과, 기록, 랭킹, 관리자, 프로필 시트
- Phaser(게임): 서바이벌 씬 (기존 SurvivalScene 이관)
- **퀴즈 오버레이는 DOM(React) 레이어로 구현** — 직접입력(키보드 입력창 N개)이 있어 캔버스보다 DOM이 수월. 게임은 퀴즈 동안 일시정지라 성능 문제 없음
- 패키지: `phaser`, `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `react-router-dom`, **`i18next`, `react-i18next`** ★
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. assets 전체 → `public/assets/`

---

## 3. 콘텐츠 모델

- 항목은 범용 짝 `front`/`back`(`;` 복수 표기, 첫 항목이 대표) + `example`(예문, 선택)
- `quiz_sets.learn_lang`: `en`/`ja`/`zh`… = 단어장, `null` = 일반 문제/답 (front→back 고정, 항상 선택지)
- 공식(관리자 등록, 국가별, 모든 유저 플레이) / 개인(본인만) 이원화. 공유 경로는 관리자 승격뿐
- 뜻의 언어는 `country`로 자동 결정 — **이는 문제집 "내용"의 언어이며, UI 언어(13절)와는 별개다** ★

### 권한 매트릭스 (전 기능 로그인 필수)

| 행위 | 일반 유저 | 관리자 |
|---|---|---|
| 공식 문제집 플레이 (자기 국가 + 공통) | ✅ | ✅ |
| 개인 문제집 등록·플레이·수정 | ✅ (본인 것만) | ✅ (본인 것만) |
| 공식 문제집 등록·수정·삭제·개인 승격 | ❌ | ✅ |
| 랭킹·기록 조회 | ✅ | ✅ |
| 관리자 메뉴 | ❌ | ✅ |

---

## 4. DB 스키마 (변경 없음)

**[docs/sql/01-init.sql](../sql/01-init.sql)이 단일 기준.** v9에서도 스키마 변경 없음 — UI 언어는 localStorage에만 저장한다(기기 간 동기화가 필요해지면 `04-add-ui-lang.sql`로 후속).

```
profiles       (nickname, country, role)          — 가입 트리거로 자동 생성
quiz_sets      (title, user_id, is_official, country, learn_lang)
quiz_items     (quiz_set_id, position, front, back, example)
play_histories (user_id, quiz_set_id, game_type='survival', settings, score,
                correct_count, total_count, wrong_items, played_at)
srs_progress   (user_id, quiz_item_id, ease_factor, interval_days, repetition,
                lapses, due_at, last_reviewed_at)  — 출제 순서의 근거
user_set_best  (user_id, quiz_set_id, best_score, achieved_at)  — 랭킹 요약, 트리거 유지
```

- `game_type`은 `'survival'`만 사용 (컬럼은 확장 대비 유지)
- RLS·랭킹 RPC 3종(요약 테이블 조회) v6~v8과 동일

---

## 5. 인증 흐름 (이메일 확인 포함)

Supabase 기본값(이메일 확인 ON)을 유지한다.

```
회원가입(이메일·비밀번호·닉네임·국가) → "메일함을 확인해 주세요" 안내 화면
  → 유저가 메일의 링크 클릭 → 인증 완료 → 로그인 → 로비
```

- 안내 화면에 [메일 다시 보내기](resend) 버튼과 로그인으로 돌아가기 링크를 둔다
- 미인증 상태로 로그인 시도 → 같은 안내 화면으로 유도
- 프로필(닉네임 변경·**언어 선택** ★·로그아웃)은 헤더 닉네임 탭 → **바텀시트** (모바일/데스크톱 공통)
- **세션 가드** ★(구현 반영): 세션은 있는데 profiles 행이 없으면(계정 삭제·트리거 이전 가입) 자동 로그아웃 → 로그인 화면. 로딩 화면 멈춤 방지

---

## 6. FSD 폴더 구조 (v9)

```
src/
├─ app/                      # main, providers, router(RequireAuth/RequireAdmin), SessionGuard, styles
├─ pages/
│   ├─ login/                # 로그인
│   ├─ signup/               # 가입 (닉네임 + 국가 검색 select)
│   ├─ verify-email/         # 가입 후 "메일함을 확인해 주세요" 안내
│   ├─ lobby/                # 서바이벌 시작 + 내 최고점/최근 기록 요약
│   ├─ quiz-set-list/        # 언어 탭 × [공식|내 것] + 업로드
│   ├─ quiz-set-detail/      # 문제집 보기 — 단어 목록 + 학습 상태 + [시작]
│   ├─ play/                 # 서바이벌 (Phaser 마운트 + DOM 퀴즈 오버레이)
│   ├─ result/               # 게임오버 결과 (새로고침 시 로비로 리다이렉트)
│   ├─ history/  ranking/
│   └─ admin/                # sets(목록·승격) / upload(국가+언어)
├─ widgets/
│   ├─ header/               # 닉네임 탭 → 프로필 바텀시트(닉네임 변경/언어 ★/로그아웃)
│   ├─ quiz-set-grid/        # 카드: [시작] + [문제집 보기]
│   ├─ quiz-overlay/         # 퀴즈 오버레이 — 3지선다 / 직접입력(입력창 N개)
│   ├─ pause-menu/           # 일시정지 — [계속하기] [그만하기(죽음 처리)]
│   ├─ ranking-table/  history-table/
├─ features/
│   ├─ auth/                 # 로그인/가입/이메일 확인/로그아웃
│   ├─ upload-quiz-set/  manage-quiz-set/
│   ├─ play-quiz/            # 출제 엔진 (7절) — 게임과 앱의 유일한 접점
│   └─ save-session/         # 게임오버 → 히스토리 insert + SRS upsert
├─ entities/
│   ├─ user/  quiz-set/  quiz-item/  history/  ranking/  srs-progress/
├─ game/                     # Phaser — FSD 밖, pages/play만 import, Supabase·i18n 모름 ★
│   ├─ survival/ (SurvivalScene, MainScene, upgrades, index)
│   └─ assets-manifest.ts
└─ shared/
    ├─ api/supabase.ts  config/countries.ts  config/languages.ts
    ├─ i18n/                 # ★ i18next 초기화 + resolveLang + locales/(ko|en|ja).json
    ├─ lib/ (csv 파서, shuffle, answer 채점, sm2)
    └─ ui/
```

**v8 대비 추가** ★: `shared/i18n/`, `app/SessionGuard`, 프로필 바텀시트에 언어 select

---

## 7. 출제 엔진 — SRS는 보이지 않게, 게임 안에서

복습 화면은 없다. 대신 **퀴즈가 나오는 순서 자체가 복습이다.** 유저는 그냥 게임만 하는데 저절로 (1) 잊을 때가 된 단어가 먼저 나오고 (2) 새 단어는 10개씩 익히는 만큼 풀리고 (3) 틀린 단어는 곧 다시 나온다.

### 7-1. 출제 우선순위 (게임 도중 실시간)

```
1순위  복습 예정: due_at <= now, 오래된 순   ← 이전 판들의 오답(lapses)이 자연히 여기 몰림
2순위  현재 배치의 미학습 신규 (repetition = 0)
3순위  나머지: due 임박순
+ 이번 판 오답은 5턴 쿨다운 후 랜덤 재출제 (엔진 내부 큐)

배치 해제: 현재 배치 10개 전원이 repetition ≥ 1이 되는 순간,
           게임 도중이라도 즉시 다음 position 순 10개 합류 (세션 무한 전제)
```

### 7-2. SM-2 그대로 — 장기 기억 요구 충족 확인

- **오답 이력 반영**: 게임 종료 시 `answers`가 SRS에 반영됨 — 오답은 `lapses`+1, `due_at`이 당겨져 다음 판에서 우선 출제. `play_histories.wrong_items`는 판 단위 스냅샷(결과 화면용)이고 학습 리스트는 `srs_progress`가 담당
- **익힌 단어의 재노출**: SM-2 간격이 1일 → 6일 → ~15일 → ~37일…로 성장 — **7일 뒤, 30일 뒤에도 반드시 다시 나온다.** "완전 졸업"은 없다 (간격이 길어질 뿐). 단기 기억을 장기 기억으로 옮기는 장치
- 등급은 again/good 2개 (v5 확정 유지)

### 7-3. 퀴즈 방식 — 자동 승급 고정 (모드 선택 없음)

| 카드 상태 | 방식 | 이유 |
|---|---|---|
| repetition 0~1 (낯선 단어) | **3지선다** | 재인으로 진입 장벽 낮춤, 게임 템포 유지 |
| repetition ≥ 2 (익은 단어) | **직접입력** — 복수 뜻이면 입력창 N개 | 회상 연습이 장기 기억을 강화 |

- 직접입력 채점: 입력창 수 = 정답 변형 수, 순서 무관, 중복 무효, **전부 일치해야 정답**(보상). 정규화(trim·소문자·공백 축약) 후 비교
- 3지선다 복수 정답: 정답 변형 k개(1~min(|V|,3))가 섞여 나오고 어느 것을 골라도 정답 — `correctIndices[]` (v7 유지)
- 일반 문제집(learn_lang=null): 항상 3지선다, front→back 고정
- 퀴즈 표시 중 게임은 일시정지, 정답 공개 시 예문(`example`) 노출

### 7-4. 게임↔앱 계약

```ts
export interface QuizQuestion {
  itemId: string;
  prompt: string;             // 방향에 따른 대표 표기
  mode: 'choice' | 'input';   // 엔진이 카드 repetition으로 자동 결정
  choices: string[];          // choice 모드만
  correctIndices: number[];   // 복수 정답 인덱스
  answers: string[];          // input 모드: 정답 변형 목록 (입력창 수·채점용)
  example?: string;
}
export interface AnswerLog { itemId: string; given: string; correct: boolean; }
export interface QuizSource { next(): QuizQuestion; report(log: AnswerLog): void; }
export interface GameResult { score: number; kills: number; answers: AnswerLog[]; }
```

- 퀴즈 UI가 DOM 오버레이로 나오므로, Phaser 씬은 "퀴즈 시점"에 이벤트만 발행하고 오버레이(widgets/quiz-overlay)가 QuizSource를 소비 → 결과를 씬에 돌려줌(정답 시 업그레이드 적용)
- `src/game/`은 여전히 Supabase를 모른다. **i18n도 모른다** — 게임 내 라벨은 번역 사전 주입(13-3절) ★

---

## 8. 종료·저장 규칙 (단순화)

| 상황 | 처리 |
|---|---|
| 몬스터에게 죽음 | **게임오버** → 히스토리 insert + SRS upsert → 결과 화면 |
| 일시정지 → 그만하기 | **죽은 것으로 간주** — 위와 동일 (그만하기 버튼에 "지금 점수로 기록돼요" 안내) |
| 브라우저 강제 이탈/새로고침 | 그 판 유실 (히스토리·SRS 모두 미저장 — 한 판 분량이라 감수) |

- 플레이 중 DB 접근 없음, 종료 시 각 1회 write (v6~ 동일). `user_set_best`는 트리거 자동
- `/result`는 직전 세션 state 기반 — **직접 URL 진입·새로고침 시 로비로 리다이렉트**

---

## 9. 랭킹 — 내 국가 기본

- 진입 시 **내 국가 랭킹이 기본** (profiles.country 기준). "전체 보기" 토글로 글로벌 확인
- 탭: 문제집별(최고점) / 전체(문제집별 최고점 평균 + 참여 수) / 국가 대항 — RPC 3종 유지
- **국기 이모지 대신 국가 코드 텍스트**(예: `KR`) 사용 — Windows 브라우저는 국기 이모지를 렌더링하지 못한다
- 공식 문제집 기록만 집계 (트리거가 보장)
- 날짜·숫자 표기는 현재 UI 언어의 `Intl` 포맷 ★

---

## 10. 문제집 상세 ([문제집 보기])

문제집 카드의 [시작] 옆 **[문제집 보기]** — 시작 전에 뭘 배우는지 확인하는 화면.

- 단어 목록: front / back / 예문(펼침) + **내 학습 상태** (미학습 · 학습 중 · n일 뒤 복습 · 오답 n회)
- 오답 많은 단어(lapses 높은 순)를 상단에 묶어 보여주면 취약 단어 확인 겸용
- 개인 문제집이면 여기서 [수정](단어 추가·편집·삭제) 진입
- 하단 고정 CTA: [게임 시작] → 방향 선택 시트(영→한/한→영, 마지막 선택 기억, 일반 문제집은 생략) → 플레이

---

## 11. 단계별 구현 계획

| 단계 | 내용 | 완료 기준 | 상태 |
|---|---|---|---|
| **0. Vite 이관** | pnpm+Vite+TS, js/* → src/game/, assets → public/ | 기존 게임 동작 | ✅ 완료 |
| **1. DB 구축** | docs/sql 01-init → 02-seed 실행 | 테이블·시드 확인 | ✅ 완료 |
| **2. 인증** | 가입(국가)+이메일 확인 화면+로그인 게이트+관리자 승격 | 인증 후 로비 진입 | ✅ 완료 |
| **3. 읽기 연동** | 엔진(랜덤 단계) + DOM 퀴즈 오버레이로 교체, quiz-data.js 삭제 | 퀴즈가 DB에서 | ✅ 완료 |
| **4. 게임오버 저장** | save-session + 일시정지 메뉴 + 결과 화면 | 죽으면 기록 저장 | ✅ 완료 |
| **5. 문제집** | 목록(언어 탭)+상세(문제집 보기)+개인 업로드+방향 시트 | 내 단어장으로 플레이 | ✅ 완료 |
| **6. 관리자** | admin/sets + upload + 승격 | 공식 문제집 국가별 노출 | ✅ 완료 |
| **7. SRS 출제** | 엔진에 우선순위·배치 실시간 해제·쿨다운·자동 승급(직접입력) 탑재 | 오답 우선, 익은 단어 주관식 | ✅ 완료 |
| **8. 랭킹** | 내 국가 기본 + 탭 3종 | 랭킹 표시 | ✅ 완료 |
| **9. 다국어** ★ | i18n 기반 → 추출 → 번역 → 전환 UI → 게임 주입 → 검증 | 3언어 전 화면 스모크 | 📋 계획 — [features/2026-07-08_i18n.md](../features/2026-07-08_i18n.md) 4절 |

> 이후 기능은 `docs/features/` 델타 문서로 계획·기록한다 (플랜·스킬·모델 포함). 이 표에는 한 줄 요약만 추가.

---

## 12. 운영하며 조정할 항목 (상수 튜닝)

- 배치 크기(10) · 해제 기준(전원 repetition ≥ 1) · 오답 쿨다운(5턴, 소형 문제집 완화)
- 자동 승급 기준(repetition ≥ 2) · 직접입력 "전부 일치" 난이도 (너무 어려우면 "1개 이상 일치+나머지 공개"로 완화)
- 퀴즈 등장 임계값 공식 (현 `2n²+6n` — 기존 SurvivalScene 값)
- 평균 랭킹 최소 참여 수 · 승격 시 랭킹 백필 · TTS(발음 듣기)
- **번역 품질(en/ja 베타 → 네이티브 검수) · 지원 언어 확대 · 국가→언어 매핑 테이블** ★

---

## 13. 다국어 (i18n) ★ 신설

> 결정 근거·플랜·리스크 상세는 [features/2026-07-08_i18n.md](../features/2026-07-08_i18n.md). 여기는 확정 사항 요약.

### 13-1. 언어 3개념 — 혼동 금지

| 개념 | 저장 위치 | 용도 |
|---|---|---|
| **국가** | `profiles.country` | 랭킹 집계, 공식 문제집 노출. UI 언어의 **기본값 힌트로만** 사용 |
| **학습 언어** | `quiz_sets.learn_lang` | 문제집이 가르치는 언어 |
| **UI 언어** | `localStorage 'ddalki.ui-lang'` | 인터페이스 표시 언어 (신규) |

### 13-2. UI 언어 결정 (우선순위)

```
명시 선택(localStorage) → profiles.country 매핑(KR→ko, JP→ja, 그 외→en)
  → navigator.language → en 폴백
```

- 지원 언어: **30종** — 국가 목록 51개국 전체 커버 (ko·en·ja·zh-CN·zh-TW·de·fr·it·es·pt·nl·sv·no·da·fi·pl·cs·el·ru·uk·tr·hi·id·th·vi·ms·mn·kk·ar·he). 확장 = locales JSON 추가 + 매핑 한 줄
- **지연 로딩**: ko(폴백)만 즉시, 나머지는 언어 전환 시 청크 로드(`changeUiLang()`). RTL(ar·he)은 `document.dir` 자동 전환(베스트에포트 베타)
- 전환 UI: 프로필 바텀시트 언어 select (언어 이름은 그 언어 자신으로 표기)
- i18next + react-i18next, `shared/i18n/`, 키는 화면 프리픽스 dot notation (`lobby.start`), 복수형은 언어별 CLDR 접미사

### 13-3. 게임 내 텍스트 — 사전 주입

`src/game/`은 i18n을 모른다. PlayPage가 `t()`로 만든 **번역 사전(texts)을 createSurvivalGame에 주입**하고 씬은 그리기만 한다. texts는 옵셔널 인자(미주입 시 ko 기본값) — 하위 호환. 게임 도중 언어 전환은 미지원(다음 판 적용).
