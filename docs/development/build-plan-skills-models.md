# 개발 실행 계획 — 단계별 스킬 · 작업 · 에이전트 모델

> 게임명: **딸기 서바이벌** (`ddalki-survival`, 🍓)
>
> 작성일: 2026-07-08 · 설계 기준: [supabase-quiz-fsd-v8.md](../design/supabase-quiz-fsd-v8.md) · [screens-v3.md](../screen/screens-v3.md)
>
> 목적: 설계도 11절의 단계 0~8을 실제로 구현할 때 **어떤 스킬을 로드하고, 무슨 작업을 하고, 어떤 에이전트 모델로 돌릴지**를 한눈에 지정한다.

---

## 사용법

- 각 단계의 서브에이전트를 표의 **에이전트 모델**로 띄우고, **사용 스킬**을 로드한 뒤 **작업**을 수행한다.
- 한 단계 안에서도 난이도가 갈리면 행을 나눠 모델을 따로 지정했다 (예: 기계적 이관 vs 통합 배선).
- 스킬은 이 레포에 로컬 설치됨(`.agents/skills/`) — `phaser-best-practices`, `frontend-design`, `supabase`, `supabase-postgres-best-practices`. 나머지(toss-design, codebase-design, tdd, vercel-*, verify 등)는 세션 전역 스킬.

## 모델 선택 기준

| 모델 | 언제 | 이 프로젝트에서 |
|---|---|---|
| **Opus 4.8** | 설계·보안·복잡한 상태 로직 — 틀리면 비싼 것 | 아키텍처, RLS 정책, SM-2 SRS 출제 엔진, 게임↔앱 계약, 씬↔React 브리지 |
| **Sonnet 5** | 일반 기능 구현·UI·연동 — 주력 | 화면 구현, Supabase 연동, 채점, save-session, 관리자 |
| **Haiku 4.5** | 기계적·반복·정적 — 판단 여지 적은 것 | 시드 SQL, 정적 마크업, 보일러플레이트, CSV/JSON 파서 |

> 어려운 진단·리뷰에서 막히면 한 단계 위 모델로 승급. Fable 5도 선택지지만 아래 배정은 Opus/Sonnet/Haiku 3티어 기준.

---

## 단계별 지정

| 단계 | 작업 | 사용 스킬 | 에이전트 모델 |
|---|---|---|---|
| **0 이관** | pnpm+Vite+TS 셸 생성, `assets/` → `public/assets/`, 기존 씬 `js/*` → `src/game/` **CDN 전역 → ESM `import` 변환**, `quiz-data.js`는 3단계에서 교체 예정으로 임시 유지 | phaser-best-practices | Sonnet |
| **0 이관** | `pages/play`에 Phaser 마운트(생성/파괴 lifecycle), **StrictMode 이중 마운트** 처리, `Scale.FIT` → **`RESIZE`**, iOS 세이프에어리어 패딩 | phaser-best-practices, vercel-react-best-practices | **Opus** |
| **1 DB** | `docs/sql/01-init.sql` — 스키마 6테이블·인덱스, **RLS 정책**(권한 매트릭스 4-3절), 가입→profiles 트리거, `user_set_best` 요약 트리거, **랭킹 RPC 3종** | supabase-postgres-best-practices, supabase | **Opus** |
| **1 DB** | `docs/sql/02-seed.sql` — 공식 문제집·항목 시드 데이터 | supabase-postgres-best-practices | Haiku |
| **2 인증** | supabase-js 클라이언트 셋업, 로그인/가입(국가 select)/로그아웃, **이메일 확인 안내 + resend 60초 쿨다운**, 미인증 유도, `RequireAuth`/`RequireAdmin` 라우터 가드 | supabase, vercel-react-best-practices | Sonnet |
| **2 인증** | `/login` `/signup` `/verify-email` 화면 + 프로필 바텀시트(닉네임 변경·로그아웃) | toss-design, frontend-design | Sonnet |
| **3 읽기연동** | **출제 엔진 인터페이스 설계** — `QuizSource`/`QuizQuestion` 계약(7-4절), 게임↔앱 유일 접점, `quiz-data.js` 제거하고 DB에서 문항 로드 | codebase-design, supabase | **Opus** |
| **3 읽기연동** | **씬 ↔ React 이벤트 브리지** — 씬이 "퀴즈 시점" 발행 → DOM 오버레이 소비 → 정답 결과 반환(업그레이드 적용) | phaser-best-practices, vercel-composition-patterns | **Opus** |
| **3 읽기연동** | `quiz-overlay` 3지선다 DOM(반투명 딤·정답 공개·예문), 채점 로직(정규화·복수정답 `correctIndices`) | toss-design, tdd | Sonnet |
| **4 저장** | `save-session` — 게임오버 시 `play_histories` insert + `srs_progress` upsert(1회 write), 일시정지 메뉴(그만하기=죽음), 결과 화면(새로고침→로비 리다이렉트) | supabase, tdd | Sonnet |
| **5 문제집** | 목록(언어 탭 × 공식/내 것)·상세(문제집 보기·학습 상태·자주 틀리는 단어)·방향 선택 시트(localStorage 기억) | toss-design, vercel-composition-patterns, supabase | Sonnet |
| **5 문제집** | 개인 업로드 폼 + **CSV/JSON 파서**(예문 3열)·행 단위 오류 미리보기 | tdd, toss-design | Haiku |
| **6 관리자** | `admin/sets`(수정·삭제·개인 문제집 승격)·`admin/upload`(국가+언어), 폼 재사용 | supabase, toss-design | Sonnet |
| **7 SRS 출제** | **SM-2 출제 엔진 본체** — 우선순위(복습 예정→미학습 신규→due 임박), **배치 10개 실시간 해제**, 오답 5턴 쿨다운, **자동 승급**(rep≥2 → 직접입력) | codebase-design, tdd, domain-modeling | **Opus** |
| **7 SRS 출제** | 직접입력 오버레이(입력창 N개·Enter 이동·칸별 ✓/✗·못 맞힌 뜻 공개) | toss-design, tdd | Sonnet |
| **8 랭킹** | 내 국가 기본 + 전체 토글, 탭 3종(문제집별/전체/국가 대항, RPC 소비), **국가 코드 텍스트**(국기 이모지 X), 내 순위 하단 고정 | supabase, toss-design | Sonnet |
| **전 단계** | 변경 검증(플로우 실제 구동) · 버그 진단 · 코드 리뷰/정리 | verify, diagnosing-bugs, code-review, simplify | Sonnet · *(막히면 Opus)* |

---

## 스킬별 역할 요약

| 스킬 | 담당 |
|---|---|
| **phaser-best-practices** | 0·3 — Phaser 이관, React 마운트, RESIZE, 조이스틱, 씬↔React 브리지 |
| **supabase** | 2·3·4·5·6·8 — 클라이언트/인증/세션/RLS 연동 |
| **supabase-postgres-best-practices** | 1 — 스키마·RLS 정책·트리거·RPC·인덱스 (`docs/sql`) |
| **toss-design** | 모든 한국어 화면·문구·에러/빈 상태 (2·3·5·6·7·8) |
| **frontend-design** | 다크 단일 테마 비주얼 방향·타이포·아이덴티티 |
| **codebase-design** | 3·7 — 출제 엔진을 딥 모듈로(게임↔앱 계약) |
| **domain-modeling** | 7 — SRS/배치/승급 용어 고정 |
| **tdd** | 채점·파서·SRS 등 순수 로직 테스트 우선 |
| **vercel-composition-patterns** | 오버레이·컴파운드 컴포넌트 구조 |
| **vercel-react-best-practices** | React 셸 성능(react-query·zustand·리렌더) |
| **verify · diagnosing-bugs · code-review · simplify** | 전 단계 검증·진단·리뷰 루프 |

---

## 다음 단계

- 단계 0부터 순서대로 진행. 각 단계 완료 기준은 설계도 11절 표의 "완료 기준" 참조.
- 계획 변경 시 이 문서를 갱신한다.
