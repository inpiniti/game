-- ============================================================================
-- 02-seed.sql — 기초 영단어 공식 문제집 시드
-- 실행: 01-init.sql 직후 1회 (재실행하면 문제집이 중복 생성됨)
-- user_id = null (시스템), is_official = true, 대상 국가 = KR, 학습 언어 = en
-- back 의 ';' 는 복수 정답 구분자 (첫 항목이 대표 표기)
-- example 은 정답 공개 직후 표시되는 예문 (선택 — null 가능)
-- ============================================================================

with s as (
  insert into quiz_sets (title, user_id, is_official, country, learn_lang, category)
  values ('기초 영단어', null, true, 'KR', 'en', 'elementary')
  returning id
)
insert into quiz_items (quiz_set_id, position, front, back, example)
select s.id, v.pos, v.front, v.back, v.example from s, (values
  ( 1, 'apple',    '사과',                        'She ate an apple.'),
  ( 2, 'run',      '달리다;뛰다',                 'I run every morning.'),
  ( 3, 'book',     '책',                          'This book is fun.'),
  ( 4, 'water',    '물',                          'Drink more water.'),
  ( 5, 'happy',    '행복한;기쁜',                 'I am happy today.'),
  ( 6, 'house',    '집',                          'My house is small.'),
  ( 7, 'eat',      '먹다',                        'Let''s eat lunch.'),
  ( 8, 'school',   '학교',                        'We go to school.'),
  ( 9, 'friend',   '친구',                        'He is my friend.'),
  (10, 'love',     '사랑;사랑하다',               'I love my family.'),
  (11, 'time',     '시간',                        'What time is it?'),
  (12, 'day',      '날;하루',                     'Have a nice day.'),
  (13, 'night',    '밤',                          'Good night!'),
  (14, 'sun',      '해;태양',                     'The sun is bright.'),
  (15, 'moon',     '달',                          'The moon is full tonight.'),
  (16, 'dog',      '개;강아지',                   'The dog is barking.'),
  (17, 'cat',      '고양이',                      'A cat sleeps a lot.'),
  (18, 'big',      '큰',                          'That is a big tree.'),
  (19, 'anywhere', '어딘가에;아무데도;어디든지',  'You can sit anywhere.'),
  (20, 'fast',     '빠른',                        'He runs fast.')
) as v(pos, front, back, example);

-- 확인
select s.title, s.country, s.learn_lang, count(i.id) as items
from quiz_sets s left join quiz_items i on i.quiz_set_id = s.id
where s.is_official
group by s.id, s.title, s.country, s.learn_lang;
