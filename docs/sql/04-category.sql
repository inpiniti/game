-- ============================================================================
-- 04-category.sql — quiz_sets에 대상 카테고리(초등/중등/고등/일반인) 컬럼 추가
-- 실행: 01-init.sql 적용된 DB에 1회 (이미 적용됐으면 재실행 금지)
-- 설계: docs/features/2026-07-09_quiz-set-category.md
-- ============================================================================

-- category 컬럼 추가 (null 허용 = 미분류)
alter table quiz_sets
  add column category text
  check (category in ('elementary', 'middle', 'high', 'general'));

-- 카테고리별 조회 성능 향상
create index quiz_sets_category_idx on quiz_sets (category);

-- 기존 공식 시드 문제집 백필 (기초 영단어 = 초등)
update quiz_sets set category = 'elementary'
  where title = '기초 영단어' and category is null;
