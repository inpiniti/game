# 개발 플랜 — 레벨·스탯·경험치 성장 시스템

> 게임명: **딸기 서바이벌** (`ddalki-survival`, 🍓)
> 작성일: 2026-07-09 · 설계 기준: [supabase-quiz-fsd-v10.md](../design/supabase-quiz-fsd-v10.md) · 분류: **대형**
>
> 근거: DB 스키마 변경(신규 테이블+RPC) + 게임↔앱 계약 변경 + 횡단 전투 개편(플레이어 HP·확률 명중) + 게임 안팎 화면 추가. 설계 자체가 바뀌므로 대형.
>
> 확정된 설계 결정(사용자): ① 축복·스탯 **공존** ② 랭킹 **점수순 그대로** ③ 레벨업 시 **수동 배분**.

---

## 사용법

- 각 단계의 서브에이전트를 표의 **에이전트 모델(effort)** 그대로 띄우고, **사용 스킬**을 로드한 뒤 **작업**을 수행한다.
- 이 플랜을 짠 세션은 **오케스트레이션만** 한다(분류·플랜·검수·병합·보고). 구현은 표의 모델로 위임한다.
- 막히면 한 단계 위 모델/effort로 승급하고 이 문서에 기록한다.

## 모델 선택 기준 (요약)

| 모델 | effort | 언제 |
|---|---|---|
| **Opus** | high~max, thinking O | RLS·security definer RPC(치팅 방지), 게임↔앱 계약, 횡단 전투 상태 로직 |
| **Sonnet** | medium(기본)~high, thinking O | Phaser UI·앱 연동·화면 구현·react-query |
| **Haiku** | low, thinking X | 시드/백필 SQL, 단순 치환 |

---

## 단계별 지정

의존 순서: **0 → (1 ∥ 2) → 3 → (4 ∥ 5) → 6**

| 단계 | 작업 | 사용 스킬 | 에이전트 모델 (effort) | 완료 기준 |
|---|---|---|---|---|
| **0 계약·상수** | 성장 상수(경험치 티어 1/3/8·레벨곡선 `25*L^1.5`·스탯 공식)를 **단일 소스**로 정의. `PlayerStats` 타입 + `createSurvivalGame(...,initialStats)` 시그니처 + `SurvivalGameOver`에 `killsByTier`·`allocations` 확장. 씬↔앱 주입/반출 경계 설계 (설계 v10 §16-2 상수 동기화 명시) | codebase-design, domain-modeling | **Opus** (high, thinking O) | 타입·상수 파일 컴파일 통과, 씬/앱 양쪽이 같은 상수 참조 |
| **1 DB** | `docs/sql/05-stats.sql` — 설계 v10 **§16-3 객체 체크리스트 8종**: `user_stats` 테이블·RLS(read own)·`grant select`(write grant 안 함)·**security definer RPC `apply_game_result`**(서버 경험치 계산+배분 검증, `set search_path=public`)·**`grant execute`**·**`handle_new_user` 교체(스탯 행 자동 생성)**·기존 유저 백필. README 실행 이력 1줄 | supabase-postgres-best-practices, supabase | **Opus** (high, thinking O) | SQL Editor 실행 성공, RPC가 과다 배분 거부·정상 배분 반영, grant execute로 클라 호출 가능 |
| **1 DB(백필)** | 백필 문/멱등 확인 문(재실행 안전) 분리 점검 | supabase-postgres-best-practices | Haiku (low, thinking X) | 기존 profiles 전원 `user_stats` 행 존재 |
| **2a 전투 개편** | 씬에 `initialStats` 주입 소비 → **플레이어 HP**(1히트 폐지·접촉 데미지·0.8s iframe·shield 유지) + **확률 명중**(오버랩 시 hit 롤·MISS) + **회피**(접촉 시 dodge 롤) + **힘 데미지 배수**를 모든 무기에 적용 | phaser-best-practices, codebase-design | **Opus** (high, thinking O) | 스탯 주입값에 따라 HP·명중·회피·데미지가 실제로 달라짐 |
| **2b 레벨업·HUD** | `redeemEnemy` 티어별 킬 카운트 + 경험치/레벨 계산(상수 공유) + **레벨업 배분 오버레이**(일시정지·힘/민첩/체력 택1·즉시 적용·다중 순차, texts 사전 주입) + HUD에 HP바·레벨/경험치 진행바. `onGameOver`에 `killsByTier`·`allocations` 반출 | phaser-best-practices, toss-design | Sonnet (medium, thinking O) | 판 중 레벨업→배분→즉시 강해짐, 종료 payload에 티어킬·배분 포함 |
| **3 앱 연동** | `entities`에 `useUserStats` 훅(user_stats select). PlayPage: 스탯 로드→게임 생성 게이트 합류→`initialStats` 주입. 게임오버 핸들러에서 **RPC `apply_game_result` 호출**(save-session 3번째 write)→반환 스탯으로 쿼리 무효화. 경험치/레벨 계산 순수함수 테스트 | supabase, vercel-react-best-practices, tdd | Sonnet (high, thinking O) | 판 종료 후 DB 레벨/스탯 증가, 재접속 시 주입되어 유지 |
| **4 스탯 표시** | 프로필 바텀시트에 레벨·경험치바·힘/민첩/체력 읽기전용 row + 헤더 레벨 뱃지 (+로비 요약은 임시 로비라 여력 시) | toss-design, frontend-design, vercel-composition-patterns | Sonnet (medium, thinking O) | 게임 밖에서 현재 레벨·스탯 확인 가능 |
| **5 결과 화면** | `ResultState`에 `levelBefore/After`·`expGained` 추가, 결과 화면에 "레벨 N→M, +X EXP" 노출 | toss-design | Sonnet (medium, thinking O) | 게임오버 결과에 레벨업/획득 경험치 표시 |
| **6 검증** | 성장 루프 실제 구동(킬→경험치→레벨업→배분→강해짐→영속→재주입) + HP/명중/회피 체감 + 밸런스 스모크 + 상수 동기화 감사 + 리뷰/정리 | verify, diagnosing-bugs, code-review, simplify | Sonnet (medium) · *(막히면 Opus)* | 3언어 스모크에서 성장 루프 정상, 씬↔서버 상수 일치 확인 |

---

## 스킬별 역할 요약

| 스킬 | 담당 |
|---|---|
| **codebase-design** | 0·2a — 성장 계약을 딥 모듈로(씬↔앱 주입/반출 경계) |
| **domain-modeling** | 0 — 경험치·레벨·스탯·미배분 포인트 용어 고정 |
| **supabase-postgres-best-practices** | 1 — `user_stats` 스키마·RLS·security definer RPC·백필 |
| **supabase** | 1·3 — RPC 호출·react-query 연동·쿼리 무효화 |
| **phaser-best-practices** | 2a·2b — 전투 개편·레벨업 오버레이·HUD |
| **toss-design** | 2b·4·5 — 레벨업/스탯/결과 한국어 UI·문구 |
| **frontend-design · vercel-composition-patterns** | 4 — 스탯 표시 컴포넌트 구조·비주얼 |
| **vercel-react-best-practices · tdd** | 3 — 훅/게이트 리렌더, 경험치·레벨 순수함수 테스트 |
| **verify · diagnosing-bugs · code-review · simplify** | 6 — 성장 루프 구동 검증·진단·리뷰 |

---

## 하지 않는 것 (범위 제외)

- ❌ 축복(퀴즈 업그레이드) 제거·재설계 — 공존 결정. 기존 코드·밸런스 보존
- ❌ 랭킹 공정성 보정(레벨대별 분리·정규화) — 점수순 그대로 수용 결정
- ❌ 스탯 리셋/재분배(리스펙) 기능 — 1차 범위 밖
- ❌ `contract.ts`의 미사용 `GameResult` 통합/정리 — 살아있는 `SurvivalGameOver`만 확장(별도 리팩터 이슈)
- ❌ 새 라우트·화면 신설 — 기존 화면 내 추가만(screens 버전업 없음)

---

## 리스크

| 리스크 | 대응 |
|---|---|
| **상수 이중화** — 성장 상수가 씬(JS)·서버(SQL) 두 곳 → 어긋나면 배분 예산 불일치 | 0단계에서 상수를 한곳에 정의·문서화, 6단계에서 동기화 감사. 어긋나도 서버가 캡하므로 치팅은 불가(과소 배분만 발생) |
| **밸런스 급락** — 플레이어 HP+회피로 난이도 하락 | 상수 튜닝(설계 §12), 몬스터 스폰/스케일 재조정 여지 확보 |
| **치팅** — 클라가 킬 수 부풀려 경험치 인플레 | 킬 수는 기존 점수 신뢰 경계와 동일(새 취약점 아님). 스탯 배분은 서버 예산 캡으로 방어 |
| **확률 명중의 체감 불쾌** — 오토슈터에서 MISS가 답답할 수 있음 | 기본 명중 85%로 시작·MISS 피드백 명확화, 과하면 기본치 상향 튜닝 |
| **기존 유저 누락** — 백필 전 로그인 유저 | RPC가 행 없으면 upsert 생성 + 05-stats.sql 백필 이중 안전장치 |

---

## 다음 단계

- 사용자 승인 후 0단계부터 순서대로. 0 완료 후 1·2 병렬 가능.
- 설계도 v10 §11 구현 계획 표에 이 기능 한 줄(레벨·스탯) 추가 예정.
- 계획 변경 시 이 문서를 갱신한다.
