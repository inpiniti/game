-- ============================================================================
-- 01-init.sql — 전체 스키마 + RLS + 랭킹 요약 테이블/트리거 + 랭킹 함수
-- 실행: Supabase 대시보드 → SQL Editor, 프로젝트 최초 1회
-- 다음: 02-seed.sql → 03-admin-setup.md
-- 설계: docs/design/supabase-quiz-fsd-v8.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 프로필 (닉네임 + 국가 + 역할)
-- ----------------------------------------------------------------------------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
  country    text not null default 'KR',   -- ISO 3166-1 alpha-2 (KR, US, JP ...)
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- 회원가입 시 프로필 자동 생성 (가입 폼에서 metadata로 nickname/country 전달)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, country)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', '플레이어'),
    coalesce(new.raw_user_meta_data ->> 'country', 'KR')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 관리자 판별 (RLS 정책에서 사용)
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- ----------------------------------------------------------------------------
-- 2. 문제집
-- ----------------------------------------------------------------------------
create table quiz_sets (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  user_id     uuid references auth.users(id) on delete cascade,  -- null = 시드(시스템)
  is_official boolean not null default false,  -- true = 관리자 등록 공식 문제집
  country     text,                            -- 공식 대상 국가, null = 전체 공통
  learn_lang  text,                            -- 학습 언어 'en'/'ja'/'zh'..., null = 일반 문제/답
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. 항목 (단어장: front=학습 언어 단어, back=모국어 뜻 / 일반: front=문제, back=답)
--    front/back: ';' 구분 복수 표기 허용, 첫 항목이 대표 표기 — 복수 정답 선택지의 근거
--    example: 예문 (선택) — 정답 공개 직후 표시 (맥락 부호화)
-- ----------------------------------------------------------------------------
create table quiz_items (
  id          uuid primary key default gen_random_uuid(),
  quiz_set_id uuid not null references quiz_sets(id) on delete cascade,
  position    int not null default 0,
  front       text not null,
  back        text not null,
  example     text,
  created_at  timestamptz not null default now()
);

create index quiz_items_set_idx on quiz_items (quiz_set_id, position);

-- ----------------------------------------------------------------------------
-- 4. 히스토리 (한 판 단위, 불변 기록)
-- ----------------------------------------------------------------------------
create table play_histories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  quiz_set_id   uuid references quiz_sets(id) on delete set null,
  game_type     text not null,                 -- 'survival' (게임은 하나 — 컬럼은 확장 대비 유지)
  settings      jsonb not null default '{}',   -- { direction, answerMode, choiceCount }
  score         int not null default 0,
  correct_count int not null,
  total_count   int not null,
  wrong_items   jsonb not null default '[]',   -- [{ item_id, given }]
  played_at     timestamptz not null default now()
);

create index play_histories_user_idx on play_histories (user_id, played_at desc);

-- ----------------------------------------------------------------------------
-- 5. SRS 학습 진행 (유저 × 단어)
-- ----------------------------------------------------------------------------
create table srs_progress (
  user_id          uuid not null references auth.users(id) on delete cascade,
  quiz_item_id     uuid not null references quiz_items(id) on delete cascade,
  ease_factor      real not null default 2.5,   -- SM-2 EF (최소 1.3)
  interval_days    real not null default 0,
  repetition       int  not null default 0,     -- 연속 정답 (배치 해제·방식 승급 기준)
  lapses           int  not null default 0,     -- 누적 오답 (취약 단어 기준: >= 8)
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  primary key (user_id, quiz_item_id)
);

create index srs_progress_due_idx on srs_progress (user_id, due_at);

-- ----------------------------------------------------------------------------
-- 6. 랭킹 요약 테이블 — 유저×공식문제집당 최고점 1행, 트리거가 자동 유지
--    랭킹 3종이 전부 이 테이블만 조회하므로 히스토리가 커져도 랭킹은 그대로
-- ----------------------------------------------------------------------------
create table user_set_best (
  user_id     uuid not null references auth.users(id) on delete cascade,
  quiz_set_id uuid not null references quiz_sets(id) on delete cascade,
  best_score  int not null,
  achieved_at timestamptz not null,
  primary key (user_id, quiz_set_id)
);

create index user_set_best_set_idx on user_set_best (quiz_set_id, best_score desc);

-- 히스토리 insert 시: 공식 문제집 기록이고 기존 최고점보다 높을 때만 upsert
create function public.update_user_set_best() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.quiz_set_id is not null
     and exists (select 1 from quiz_sets s where s.id = new.quiz_set_id and s.is_official)
  then
    insert into user_set_best (user_id, quiz_set_id, best_score, achieved_at)
    values (new.user_id, new.quiz_set_id, new.score, new.played_at)
    on conflict (user_id, quiz_set_id) do update
      set best_score  = excluded.best_score,
          achieved_at = excluded.achieved_at
      where excluded.best_score > user_set_best.best_score;
  end if;
  return new;
end $$;

create trigger on_play_history_insert
  after insert on play_histories
  for each row execute function public.update_user_set_best();

-- ----------------------------------------------------------------------------
-- 7. RLS — 전 기능 로그인 필수 (anon 접근 없음)
-- ----------------------------------------------------------------------------
alter table profiles       enable row level security;
alter table quiz_sets      enable row level security;
alter table quiz_items     enable row level security;
alter table play_histories enable row level security;
alter table srs_progress   enable row level security;
alter table user_set_best  enable row level security;

-- 프로필: 닉네임·국가는 전체 읽기(랭킹 표시용), 수정은 본인만
create policy "read profiles" on profiles for select
  to authenticated using (true);
create policy "update own profile" on profiles for update
  to authenticated using (auth.uid() = id);

-- role 자가 승격 차단: 수정 가능 컬럼을 nickname/country로 제한
revoke update on profiles from anon, authenticated;
grant  update (nickname, country) on profiles to authenticated;
-- role 변경은 SQL Editor에서만 (03-admin-setup.md)

-- 문제집: 공식이거나 본인 것만 읽기
create policy "read visible sets" on quiz_sets for select
  to authenticated using (is_official or auth.uid() = user_id);

-- 개인 문제집: 본인 것만, 공식 플래그는 못 만짐
create policy "write own personal sets" on quiz_sets for all
  to authenticated
  using (auth.uid() = user_id and not is_official)
  with check (auth.uid() = user_id and not is_official);

-- 관리자: 모든 문제집 관리 (공식 등록, 개인→공식 승격 포함)
create policy "admin manages sets" on quiz_sets for all
  to authenticated
  using (is_admin()) with check (is_admin());

-- 단어: 소속 문제집의 권한을 따라감
create policy "read items of visible sets" on quiz_items for select
  to authenticated
  using (exists (select 1 from quiz_sets s where s.id = quiz_set_id
                 and (s.is_official or s.user_id = auth.uid())));
create policy "write items of own personal sets" on quiz_items for all
  to authenticated
  using (exists (select 1 from quiz_sets s where s.id = quiz_set_id
                 and s.user_id = auth.uid() and not s.is_official))
  with check (exists (select 1 from quiz_sets s where s.id = quiz_set_id
                      and s.user_id = auth.uid() and not s.is_official));
create policy "admin manages items" on quiz_items for all
  to authenticated
  using (is_admin()) with check (is_admin());

-- 히스토리·SRS: 본인 것만 (타인 기록은 아래 랭킹 함수로만 집계 노출)
create policy "own histories" on play_histories for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own srs_progress" on srs_progress for all
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 랭킹 요약: 본인 것만 읽기 (쓰기는 트리거 전용 — security definer라 정책 불필요)
create policy "read own bests" on user_set_best for select
  to authenticated using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 8. 랭킹 함수 — user_set_best만 조회 (security definer, 집계 결과만 반환)
--    공식 문제집 기록만 요약에 들어가지만, 강등된 문제집 잔존 행 대비로
--    is_official 조인을 한 번 더 건다
-- ----------------------------------------------------------------------------

-- 8-1. 문제집별 랭킹: 유저별 최고 점수 (p_country로 같은 국가끼리 필터 가능)
create function public.ranking_by_set(
  p_set_id uuid, p_country text default null, p_limit int default 100
)
returns table (rank bigint, nickname text, country text, best_score int, achieved_at timestamptz)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by b.best_score desc, b.achieved_at asc),
         p.nickname, p.country, b.best_score, b.achieved_at
  from user_set_best b
  join quiz_sets s on s.id = b.quiz_set_id and s.is_official
  join profiles p on p.id = b.user_id
  where b.quiz_set_id = p_set_id
    and (p_country is null or p.country = p_country)
  order by b.best_score desc, b.achieved_at asc
  limit p_limit;
$$;

-- 8-2. 전체 랭킹: 유저별 (문제집별 최고점)의 평균 + 참여 문제집 수
--      합산이 아닌 평균 — "많이 깬 사람"이 아니라 "잘 깬 사람"이 이긴다
create function public.ranking_overall(
  p_country text default null, p_limit int default 100
)
returns table (rank bigint, nickname text, country text, avg_score numeric, sets_played bigint)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by t.avg_score desc, t.sets_played desc),
         p.nickname, p.country, t.avg_score, t.sets_played
  from (
    select b.user_id, round(avg(b.best_score), 1) as avg_score, count(*) as sets_played
    from user_set_best b
    join quiz_sets s on s.id = b.quiz_set_id and s.is_official
    group by b.user_id
  ) t
  join profiles p on p.id = t.user_id
  where p_country is null or p.country = p_country
  order by t.avg_score desc, t.sets_played desc
  limit p_limit;
$$;

-- 8-3. 국가 랭킹 (국가 대항): 국가별 "유저 평균점의 평균" + 참여 인원
--      합산이면 유저 수 많은 국가가 무조건 이기므로 평균으로 국가 규모 보정
create function public.ranking_by_country(p_limit int default 50)
returns table (rank bigint, country text, avg_score numeric, players bigint)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by avg(u.user_avg) desc),
         u.country, round(avg(u.user_avg), 1), count(*)
  from (
    select p.id, p.country, avg(b.best_score) as user_avg
    from user_set_best b
    join quiz_sets s on s.id = b.quiz_set_id and s.is_official
    join profiles p on p.id = b.user_id
    group by p.id, p.country
  ) u
  group by u.country
  order by avg(u.user_avg) desc
  limit p_limit;
$$;

-- 랭킹 함수는 로그인 유저만 호출 가능
revoke execute on function public.ranking_by_set(uuid, text, int)  from public, anon;
revoke execute on function public.ranking_overall(text, int)       from public, anon;
revoke execute on function public.ranking_by_country(int)          from public, anon;
grant  execute on function public.ranking_by_set(uuid, text, int)  to authenticated, service_role;
grant  execute on function public.ranking_overall(text, int)       to authenticated, service_role;
grant  execute on function public.ranking_by_country(int)          to authenticated, service_role;
