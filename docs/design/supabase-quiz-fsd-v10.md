# 설계도 v10 — 딸기 서바이벌 (ddalki-survival): 레벨·스탯·경험치

> 작성일: 2026-07-09 · [v9](./supabase-quiz-fsd-v9.md) 대체 · 게임명: **딸기 서바이벌** (영문 `ddalki-survival`, 🍓)
>
> **v9 대비 변경점 — 성장(레벨·경험치·스탯) 도입** (플랜: [development/2026-07-09_level-stats-plan.md](../development/2026-07-09_level-stats-plan.md))
> 1. **영구 성장 축 신설** — 몬스터를 잡으면 경험치가 쌓이고, 경험치로 레벨업, 레벨업마다 스탯 포인트 1개를 **직접 배분**(힘/민첩/체력). 레벨·경험치·스탯은 **DB에 영속**되어 판이 끝나도, 로그인 기기를 바꿔도 유지된다.
> 2. **전투 개편(횡단)** — 플레이어가 **HP를 갖는다**(현재 1히트 즉사 → 체력이 다 깎여야 죽음). 공격 **명중이 확률**이 되고(현재 100%), **회피** 개념이 생긴다. 셋 다 스탯으로 강화.
> 3. **축복(퀴즈 업그레이드)과 공존** — 기존 축복(퀴즈 정답 시 화살 개수/연사/관통)은 **한 판 한정 임시 강화** 그대로. 레벨/스탯은 **영구 성장**. 두 축이 별개로 굴러간다. (기존 축복 코드·밸런스 보존)
> 4. **스키마 변경 있음** — 신규 `user_stats` 테이블 + 서버 검증 RPC `apply_game_result`. `docs/sql/05-stats.sql`로 추가(기존 파일 무수정, README 관례).
> 5. **랭킹 공정성** — 영구 성장이 고레벨에게 유리하지만 **랭킹은 점수순 그대로 수용**(성장형 게임의 자연스러운 특성으로 간주, §9 무변경). 향후 튜닝 항목으로만 남김.
>
> 유지: v9의 모든 것 — 단일 서바이벌, 종료=죽음, 보이지 않는 SRS 출제 엔진, 자동 승급, i18n(게임 내 텍스트 사전 주입), 공식/개인 이원화, docs/sql 수동 운영, 축복 업그레이드.

---

## 이 문서에서 새로 정의하는 절 (v9 대비 신설·수정)

- **§14 성장 시스템** — 개념·경험치·레벨·스탯 효과 공식 (신설)
- **§15 전투 개편** — 플레이어 HP·확률 명중·회피 (신설, 기존 §1 게임 정의 보강)
- **§16 데이터 모델·서버 검증** — `user_stats` + RPC (§4 스키마 델타)
- **§17 게임↔앱 계약 확장** — 스탯 주입·결과 반출 (§7-4 확장)
- **§18 화면 변경(델타)** — 게임 내 레벨업 배분 UI + 게임 밖 스탯 표시
- **§12 튜닝 항목**에 성장 상수 추가

> v9 §1~§13 중 위에서 다시 정의하지 않은 절은 **그대로 유효**하다.

---

## 14. 성장 시스템 (신설)

### 14-1. 개념 — 두 개의 성장 축

| 축 | 원천 | 지속 | 성격 |
|---|---|---|---|
| **축복(업그레이드)** | 퀴즈 정답 | **한 판** (죽으면 리셋) | 화살 개수·연사·관통. 기존 유지 |
| **레벨·스탯** ★ | 몬스터 처치(경험치) | **영구**(DB) | 힘·민첩·체력. 판을 이어가며 축적 |

- 한 판 안에서 둘 다 동작한다: 퀴즈 맞히면 축복, 몬스터 잡아 레벨업하면 스탯 포인트. **레벨업·배분은 게임 도중 즉시 일어나고 즉시 강해진다.** 배분 결과는 그 판이 끝날 때 DB에 영속된다.

### 14-2. 경험치 — 강한 몬스터가 더 준다

몬스터는 이미 3티어다(v9 게임: `e_weak` hp10 / `e_mid` hp24 / `e_strong` hp60). 처치 시 티어별 경험치:

| 티어 | 경험치 | 근거 |
|---|---|---|
| `e_weak` | **1** | 기본 |
| `e_mid` | **3** | 중간(60초~) |
| `e_strong` | **8** | 강함(150초~) |

- 경험치는 **누적 총량**(`exp`)으로 저장한다. "이번 레벨 진행도"는 표시할 때 계산.

### 14-3. 레벨 — 오를수록 더 많이 필요

```
expToNext(L) = round(25 * L^1.5)     // L→L+1 에 필요한 경험치 (튜닝 상수)
```

| 레벨 | 다음 레벨까지 | 누적 |
|---|---|---|
| 1→2 | 25 | 25 |
| 2→3 | 71 | 96 |
| 3→4 | 130 | 226 |
| 5→6 | 280 | ~800 |
| 10→11 | 791 | ~4,700 |

- 레벨업 1회당 **미배분 스탯 포인트(`unspent`) +1**.
- 한 판에 여러 번 레벨업 가능 — 배분 UI를 순차로 띄운다.

### 14-4. 스탯 효과 (전부 §12 튜닝 상수)

| 스탯 | 효과 | 공식 | 초기(스탯 0) |
|---|---|---|---|
| **힘 STR** | 공격력 배수 | `dmgMul = 1 + 0.12 * str` | ×1.0 |
| **민첩 AGI** | 명중률 | `hit = min(0.99, 0.85 + 0.02 * agi)` | 85% |
| | 회피율 | `dodge = min(0.60, 0.02 * agi)` | 0% |
| **체력 STA** | 최대 HP | `maxHp = 3 + 2 * sta` | 3 |

- **힘**: 모든 무기 데미지(화살·오라·오비터·연쇄구원)에 `dmgMul`을 곱한다.
- **민첩**: 명중은 플레이어 공격이 적에게 맞을 확률(빗나가면 MISS·데미지 0), 회피는 적 접촉 시 무피해로 흘릴 확률.
- **체력**: 아래 §15의 플레이어 HP를 결정.

---

## 15. 전투 개편 (신설 · 횡단)

### 15-1. 플레이어 HP — 1히트 즉사 폐지

- 플레이어는 `maxHp = 3 + 2*sta`의 체력을 갖는다. 적 접촉 시 **접촉 데미지 1**(플랫) — HP가 0 이하가 되면 그때 `endGame('death')`.
- 피격 후 **0.8초 무적(iframe)** — 한 접촉으로 HP가 순삭되는 것 방지(깜빡임 연출, 기존 shield 무적 패턴 재사용).
- 기존 **shield(방어막)**: 그대로 유지 — 있으면 접촉을 통째로 흡수(HP 소모 없음). shield → HP 순.
- 체력을 스탯으로 올리면 즉시 `maxHp` 증가 + 증가분만큼 현재 HP도 회복(레벨업 배분의 즉시 보상감).

### 15-2. 확률 명중 — 100% 폐지

- 현재 화살은 물리 오버랩으로 100% 명중. 개편: 오버랩 시 `Math.random() < hit`일 때만 데미지, 아니면 **MISS**(플로팅 텍스트, 화살은 관통 규칙대로 처리).
- 명중은 플레이어 스탯 `hit`만 사용(적에는 방어/회피 없음 — 대칭 복잡도 회피).

### 15-3. 회피

- 적 접촉(무적 아님·shield 없음) 시 `Math.random() < dodge`면 **DODGE**(무피해 + 짧은 iframe). 아니면 접촉 데미지.

### 15-4. HUD

- 좌상단 HUD에 **HP 바 + 레벨/경험치 진행바**를 추가한다(기존 5줄 HUD 확장, `updateHud()`).

---

## 16. 데이터 모델 · 서버 검증 (§4 스키마 델타)

**`docs/sql/05-stats.sql` 신규** (기존 `01-init.sql` 무수정, README 관례).

### 16-1. 테이블

```sql
create table user_stats (
  user_id  uuid primary key references profiles(id) on delete cascade,
  level    int not null default 1,
  exp      int not null default 0,     -- 누적 경험치 총량
  str      int not null default 0,
  agi      int not null default 0,
  sta      int not null default 0,
  unspent  int not null default 0,     -- 미배분 포인트
  updated_at timestamptz not null default now()
);
```

- RLS: `read own`(본인 행 select). 랭킹에서 남의 레벨을 보여줄 거면 `read all` 추가(1차는 read own만).
- **직접 update·insert 권한 없음** — `grant select`만 주고 insert/update/delete grant는 안 준다. RLS와 grant **둘 다**로 막아야 확실. 변경은 오직 아래 RPC(security definer)로만. (v9 `profiles`가 grant 화이트리스트로 nickname/country만 여는 것과 같은 방어 철학. 스탯 자가조작 차단.)
- 신규 가입자 자동 생성: **`handle_new_user()`를 `create or replace`로 교체**해 `user_stats` 행도 함께 insert(확정). 01-init.sql은 동결이라 05에서 교체. 게임 한 판도 안 한 신규 유저의 "행 없음" 엣지케이스 제거.
- 기존 유저 백필: `insert into user_stats(user_id) select id from profiles on conflict do nothing;`

### 16-2. 서버 검증 RPC — 치팅 방지의 핵심

```
apply_game_result(kills_weak, kills_mid, kills_strong,
                  alloc_str, alloc_agi, alloc_sta) → user_stats
```

security definer, `auth.uid()` 기준. 서버가 **경험치를 직접 계산**하고 **배분 예산을 검증**한다:

1. `exp_gain = kills_weak*1 + kills_mid*3 + kills_strong*8` (서버에서 계산 — 클라가 exp를 못 부풀림)
2. 없으면 행 생성(upsert). `new_exp = exp + exp_gain`, `new_level = levelFor(new_exp)` (§14-3 곡선, 서버가 재계산)
3. `points_gained = new_level - old_level`, `unspent += points_gained`
4. **검증**: `alloc_* ≥ 0` 그리고 `alloc_str+alloc_agi+alloc_sta ≤ unspent` — 위반 시 예외(배분 무효)
5. 적용: `str/agi/sta += alloc_*`, `unspent -= 합`, `level = new_level`, `exp = new_exp`
6. 갱신 후 행 반환

- **신뢰 경계**: 경험치는 클라가 보고한 **킬 수**에서 나온다. 킬 수는 이미 v9에서 점수(`score = kills*10 + sec`)의 근거로 클라가 보고하는 값 — **경험치 신뢰도는 기존 점수 신뢰도와 동일**(새로운 취약점 아님). 반면 **스탯 배분은 서버가 예산으로 캡** — 클라가 str=9999를 보내도 막힌다.
- **상수 동기화**: 경험치·레벨 곡선 상수(§14-2/14-3)는 게임(씬, JS)과 서버(SQL)에 **양쪽 존재**한다. 씬은 판 도중 레벨업 횟수를 곡선으로 계산해 배분 UI를 띄우고, 서버는 같은 곡선으로 재검증한다. **두 곳의 상수가 반드시 일치해야 한다**(플랜의 리스크 항목).

### 16-3. `05-stats.sql` 객체 체크리스트 (1단계 DB — 빠뜨리기 쉬운 것 포함)

| # | 객체 | 놓치면 |
|---|---|---|
| 1 | `create table user_stats` (§16-1) | — |
| 2 | `enable row level security` + `read own` 정책 | 조회 불가 |
| 3 | `grant select on user_stats to authenticated` (insert/update/delete grant 안 함) | RLS만으론 부족·직접쓰기 뚫림 |
| 4 | `create function apply_game_result(...) security definer` (§16-2) | — |
| 5 | **`grant execute on function apply_game_result to authenticated`** | 클라가 RPC 호출 자체 불가 → 게임오버 저장 조용히 실패 |
| 6 | 함수에 **`set search_path = public`** | security definer search_path 공격 노출 |
| 7 | **`create or replace function handle_new_user()`** — 기존 로직 + `insert into user_stats(user_id) values (new.id)` (확정) | 신규 유저 스탯 행 없음 |
| 8 | 백필 `insert ... select id from profiles on conflict do nothing` | 기존 유저 행 없음 |

- 인덱스 불필요(조회 전부 `user_id` PK, 레벨 랭킹 안 함). README 실행 이력 1줄 추가.

---

## 17. 게임↔앱 계약 확장 (§7-4 확장)

v9의 살아있는 계약은 `src/game/survival/index.ts`의 `SurvivalBridge`/`SurvivalGameOver`다(`contract.ts`의 `GameResult`는 미사용 — 이번에도 살아있는 쪽만 확장).

### 17-1. 주입 — 게임 시작 시 현재 스탯

```ts
// 시그니처 확장
createSurvivalGame(parent, bridge, texts?, initialStats?: PlayerStats)
interface PlayerStats { level: number; exp: number; str: number; agi: number; sta: number; unspent: number }
```

- `preBoot`에서 `registry.set('stats', initialStats)` (texts 주입과 동일 패턴). 씬 `create()`에서 꺼내 `maxHp`·`dmgMul`·`hit`·`dodge` 초기화.
- 주입 소스: PlayPage가 신규 훅 `useUserStats()`로 로드. 게임 생성 게이트(`source` 준비 조건)에 스탯 로딩도 합류.

### 17-2. 반출 — 종료 시 킬 티어 + 배분 델타

```ts
interface SurvivalGameOver {
  score; kills; seconds; reason;              // 기존
  killsByTier: { weak: number; mid: number; strong: number };  // ★ 서버 경험치 계산용
  allocations: { str: number; agi: number; sta: number };      // ★ 이번 판 배분 델타
}
```

- 씬은 티어별 킬을 카운트(`redeemEnemy`에서 티어 분기)하고, 판 도중 배분한 델타를 누적해 `onGameOver`에 실어 보낸다.
- PlayPage 게임오버 핸들러 → `save-session`에 3번째 write 추가: **RPC `apply_game_result` 호출** → 반환된 새 레벨/스탯으로 결과 화면 표시 + `authQueryKeys.profile`/스탯 쿼리 무효화.

### 17-3. 결과 화면

- `ResultState`에 `levelBefore/levelAfter`, `expGained`, `leveledUp` 추가 → "레벨 3 → 5, +142 EXP" 노출.

---

## 18. 화면 변경 (델타)

> 새 라우트·화면 신설 없음 → `screens-v3` 버전업 불필요. 기존 화면 안에서의 추가만.

### 18-1. 게임 내 — 레벨업 스탯 배분 (신설 오버레이)

- 레벨업 순간 게임 일시정지(기존 `showUpgradePanel()` 패턴, Phaser 캔버스 오버레이 depth 40000대). "레벨 업! 스탯을 찍으세요" + **[힘] [민첩] [체력]** 버튼 3개.
- 택1 → 해당 스탯 +1 **즉시 적용**(데미지/명중/회피/HP 재계산, 체력이면 현재 HP도 회복) → 재개. 다중 레벨업은 순차.
- 게임은 i18n을 모르므로 세 스탯 라벨·안내문은 **texts 사전에 주입**(§13-3 방식 확장).

### 18-2. 게임 밖 — 스탯 표시

| 위치 | 표시 | 우선순위 |
|---|---|---|
| **프로필 바텀시트** (`widgets/profile-sheet`) | 레벨·경험치 진행바·힘/민첩/체력(읽기전용 row, 이메일 row 패턴 재사용) | 1 |
| **헤더** (`widgets/header`) | 닉네임 옆 레벨 뱃지 | 2 |
| **로비** (`pages/lobby`) | 레벨·스탯 요약 카드 (단, 아직 "임시 로비"라 정식 교체 시 반영) | 3 |

- 읽기 경로: `entities/user`(또는 신규 `entities/player-stats`)에 `useUserStats` 훅 — `user_stats` select. `Profile`과 별개 쿼리(별 테이블).

---

## 12. 운영하며 조정할 항목 (성장 상수 추가)

> v9 §12 유지 + 아래 추가.

- **경험치**: 티어별 획득(1/3/8) · 레벨 곡선 계수(`25 * L^1.5`) · 레벨당 포인트(1)
- **스탯 효과**: 힘 계수(0.12) · 명중 기본/계수/상한(0.85·0.02·0.99) · 회피 계수/상한(0.02·0.60) · 체력 기본/계수(3·2)
- **전투**: 접촉 데미지(1) · 피격 무적 시간(0.8초) · 시작 스탯(전부 0 — 너무 척박하면 시작 포인트 지급 검토)
- **밸런스 관찰**: HP·회피 도입으로 난이도가 급락할 수 있음 → 몬스터 스폰/스케일 재튜닝 여지. 영구 성장의 랭킹 유불리(신규 vs 고레벨)는 수용하되 과하면 §9 랭킹 보정 재검토
- **상수 동기화 감사**: 씬(JS)·서버(SQL) 성장 상수 일치 여부를 변경 때마다 확인
