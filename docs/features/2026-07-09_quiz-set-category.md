# 기능: 문제집 카테고리 — 초등·중등·고등·일반인 대상 구분 + 필터

> 작성일: 2026-07-09 · 기준 설계: [supabase-quiz-fsd-v8.md](../design/supabase-quiz-fsd-v8.md) · [screens-v3.md](../screen/screens-v3.md) · 스키마: [docs/sql/01-init.sql](../sql/01-init.sql) · 분류: **중형**
>
> `quiz_sets`에 대상(카테고리) 단일 컬럼을 추가하고, 문제집 선택 화면·업로드/승격 폼에 카테고리 필터/입력을 더한다. 라우트·게임↔앱 계약·FSD 구조·랭킹은 변경 없음 — 기존 화면 안의 additive 기능.

---

## 1. 왜

- 문제집이 늘면 "기초 영단어"부터 "토익 500"까지 대상 수준이 뒤섞여, 유저가 자기 수준에 맞는 문제집을 고르기 어렵다.
- 초등/중등/고등/일반인의 4단계 대상 구분을 주면 문제집 선택 화면에서 한 번에 걸러 볼 수 있다.
- 공식 문제집(교육 과정 기반)뿐 아니라 개인 문제집도 태깅해, 내 문제집을 수준별로 정리할 수 있게 한다.

## 2. 핵심 설계 결정

사용자 확정 사항(플랜 단계 조율):

| 결정 | 값 | 근거 |
|---|---|---|
| 적용 범위 | **공식 + 개인 둘 다** | 개인 문제집도 수준별 정리 필요. 미지정(미분류) 허용 |
| 카테고리 개수 | **단일** (한 문제집 = 한 카테고리) | 스키마·필터·UI 단순. 겹치면 대표 하나만 선택 |
| 필터 UI | **언어 탭 아래 칩 행** | 언어·구분과 독립 AND 필터, 화면 델타 최소 |
| 저장 형태 | **코드 저장** (한글 라벨은 config) | `config/countries.ts`·`config/languages.ts`와 동일 패턴 — 정렬·i18n·변경 안전 |

### 2-1. 카테고리 상수 (단일 소스)

`src/shared/config/categories.ts` — 코드·한글 라벨·정렬 순서를 여기 한 곳에서만 정의. 다른 곳은 전부 이 상수를 참조(하드코딩 금지).

```ts
export const CATEGORIES = [
  { code: 'elementary', label: '초등' },
  { code: 'middle',     label: '중등' },
  { code: 'high',       label: '고등' },
  { code: 'general',    label: '일반인' },
] as const;

export type CategoryCode = typeof CATEGORIES[number]['code']; // 'elementary' | ... | 'general'
// quiz_sets.category: CategoryCode | null   (null = 미분류)
```

### 2-2. 스키마 델타 (additive)

`quiz_sets`에 컬럼 하나 추가. nullable(미분류 허용), CHECK로 4종 제한, 필터용 인덱스.

```sql
alter table quiz_sets
  add column category text
  check (category in ('elementary','middle','high','general'));   -- null 허용 = 미분류

create index quiz_sets_category_idx on quiz_sets (category);
```

- **미배포 상태면** `docs/sql/01-init.sql`의 `quiz_sets` 정의에 직접 반영하는 편이 깔끔(2절 컬럼 추가 + 인덱스). **이미 적용된 DB면** 별도 마이그레이션 `docs/sql/04-category.sql`로. → 구현 시 배포 여부 확인 후 택1 (6절 리스크).
- RLS 정책은 그대로 — 컬럼 추가는 기존 `read visible sets` / `write own personal sets` / `admin manages sets` 정책에 영향 없음.

### 2-3. 필터 규칙

- 카테고리 필터는 기존 **언어 탭 · 구분(공식/내 것)과 독립적인 AND 조건**.
- 기본 선택 = **[전체]** (미분류 포함 모두 노출). 특정 카테고리 선택 시 `category = <code>`인 문제집만.
- `category is null`(미분류)은 [전체]에서만 보이고, 특정 카테고리 칩에는 안 잡힌다.

## 3. 화면 변경 (델타)

레이아웃 변경 없음 — [screens-v3.md 6절](../screen/screens-v3.md) 문제집 선택 화면에 **칩 행 하나 추가**만.

```
+------------------------------------------------------------------+
| 언어:  [영어단어] [일본어단어] [일반]        ← 기존 learn_lang 탭    |
| 대상:  [전체] [초등] [중등] [고등] [일반인]   ← ★ 추가된 카테고리 칩  |
| 구분:  [공식] [내 문제집]                        [+ 업로드]        |
+------------------------------------------------------------------+
|  (언어 × 대상 × 구분 AND 필터 결과 카드 그리드)                     |
+------------------------------------------------------------------+
```

- **업로드/승격 폼** (screens-v3 13절): 제목·국가·언어 옆에 `[대상: 카테고리 ▼]` select 추가(미분류=선택 안 함 허용). 개인 업로드 폼에도 동일.
- **문제집 상세** (screens-v3 7절, 선택): 헤더 메타 줄에 `초등` 배지 표시 — `영어단어 · 초등 · 단어 20개 · 학습 15/20`.

## 4. 플랜 — 단계 × 스킬 × 모델

> **실행 조정 (2026-07-09, 구현 착수 시 실제 코드 확인 후):**
> - Base 앱은 이미 구현돼 있고(`src/`, FSD 완비) **i18n(i18next·30 로케일, fallback=`ko`)까지 도입됨.** → 카테고리 라벨도 하드코딩이 아니라 **i18n 키**로. 누락 키는 ko 폴백이라 **ko.json(+en.json 품질용)만** 추가, 나머지 28개는 자동 폴백.
> - `quiz_sets` 조회 훅이 **명시적 컬럼 select** (`useQuizSets`·`useAdminQuizSets`·`useQuizSet`)이라 `category`를 select 문자열·Raw타입·매핑에 추가해야 함. 이 read/write 플러밍(+타입+i18n 키)을 전부 **c-0에 흡수** → 병렬 UI 에이전트(c-2·c-3·c-5)가 같은 파일을 건드리지 않음.
> - **DB는 사용자가 이미 마이그레이션 완료** → c-1은 실행이 아니라 `04-category.sql`(ALTER+index+백필)·`02-seed.sql` **기록**만. c-4는 c-1에 합침.
> - c-0을 **Haiku→Sonnet(medium)으로 승급**: 타입 계약 + i18n live-binding 패턴 복제 + 6개 훅 배선이라 틀리면 전 UI에 파급.
>
> 의존: **(c-0 ∥ c-1) → (c-2 ∥ c-3 ∥ c-5) → 빌드·검증**

| 단계 | 작업 (파일) | 사용 스킬 | 에이전트 모델 (effort) | 완료 기준 |
|---|---|---|---|---|
| **c-0 기반** | `shared/config/categories.ts`(신규, `languages.ts` live-binding 패턴 복제) + `entities/quiz-set/model/types.ts`(`category` 추가) + 훅 6개(`useQuizSets`·`useAdminQuizSets`·`useQuizSet` select/매핑, `useCreateQuizSet`·`useUpdateQuizSet` 배선) + `i18n/locales/ko.json`·`en.json`(category 키) | domain-modeling | **Sonnet (medium, thinking O)** | `tsc` 통과, categoryLabel 단일 참조, 모든 훅이 category 왕복 |
| **c-1 SQL 기록** | `docs/sql/04-category.sql`(신규: ALTER+CHECK 4종+index+기존 공식셋 백필) + `docs/sql/02-seed.sql`(insert에 category 열 추가) | supabase-postgres-best-practices | Haiku (low, thinking X) | 스키마 델타가 재현 가능하게 기록, 시드가 카테고리 포함 |
| **c-2 목록 필터** | `pages/quiz-set-list/QuizSetListPage.tsx`(+css): 언어 탭 아래 `[전체][초등][중등][고등][일반인]` 칩 행, `categoryFilter` 상태(default 'all'), 언어·구분과 AND. 기존 `.tab` 스타일 재사용 | toss-design | Sonnet (medium, thinking O) | 칩 선택 시 해당 카테고리만, 전체=미분류 포함 |
| **c-3 폼 배선** | `upload-quiz-set`(`useUploadQuizSet.ts`·`UploadQuizSetForm.tsx`) + `admin-sets`(`CountryLangFields.tsx`·`EditSetSheet.tsx`·`PromoteSetSheet.tsx`)에 `[대상]` 칩(미분류=null 허용) | supabase, toss-design | Sonnet (medium, thinking O) | 업로드·수정·승격 시 category 저장 → 목록 필터 반영 |
| **c-5 상세 배지** | `pages/quiz-set-detail/QuizSetDetailPage.tsx`(+css) 헤더 메타에 카테고리 배지(있을 때만) | toss-design | Haiku (low, thinking X) | 상세 상단에 대상 노출, 미분류는 배지 없음 |
| **빌드·검증** | `pnpm tsc`/`build` 통과 + 필터 조합·저장 왕복 수동 확인 | verify | Sonnet (medium, 막히면 Opus high) | 빌드 성공 + 세 필터 AND·미분류 처리 확인 |

## 5. 하지 않는 것 (명시적 범위 제외)

- ❌ **복수 카테고리**(배열/조인 테이블) — 단일로 확정. 겹치면 대표 하나만.
- ❌ **카테고리별 랭킹 탭·집계** — 랭킹은 공식 문제집 기준 그대로. 카테고리는 필터 전용.
- ❌ **카테고리 필수화** — nullable(미분류) 유지. 개인 문제집은 특히 선택.
- ❌ **카테고리 관리 UI**(추가·편집·삭제) — 4종 고정, `categories.ts` 상수로만 관리.
- ❌ **세분류**(중1/중2, 학년 단위) — 4단계까지만. 필요 시 별도 델타.

## 6. 리스크

| 리스크 | 대응 |
|---|---|
| 기존 문제집 `category=null`이라 특정 칩에서 안 보임 | c-4 시드 백필 + '전체'는 미분류 포함으로 명시, 빈 결과 시 안내 문구 |
| 언어×대상×구분 3중 AND로 결과 0건 빈발 | 빈 상태 문구("이 조건의 문제집이 없어요") 제공, 필요 시 칩에 건수 배지(후속) |
| 코드↔한글 라벨이 여러 파일에 산재 | `shared/config/categories.ts` 단일 소스 강제 — 하드코딩 금지(c-0) |
| 01-init 직접 수정 vs 마이그레이션 선택 실수 | c-1에서 **배포 여부 먼저 확인** — 미배포=01-init 반영, 배포=04-category.sql |
| CHECK 제약과 config 코드 불일치 | 4종 코드 문자열을 categories.ts·CHECK 양쪽에 동일하게(검증 단계에서 왕복 확인) |
