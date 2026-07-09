-- ============================================================================
-- 05-stats.sql — user_stats(레벨·경험치·스탯 영속) + 서버검증 RPC apply_game_result
-- 실행: 01-init.sql 적용된 DB에 1회 (멱등 안전 — 재실행 가능하도록 작성)
-- 설계: docs/design/supabase-quiz-fsd-v10.md §16
--
-- ⚠️ MUST MATCH: src/shared/lib/growth.ts (설계 v10 §16-2 상수 동기화)
--   경험치 티어(weak 1 / mid 3 / strong 8) · 레벨 곡선(expToNext = round(25*L^1.5))
--   · 레벨당 포인트(1). 여기 값을 바꾸면 growth.ts 도 함께 바꿔라(양쪽 불일치 시 배분 예산 어긋남).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. user_stats — 유저당 1행(레벨·누적경험치·스탯·미배분 포인트)
--    변경은 오직 apply_game_result(security definer)로만. 직접 쓰기 권한 없음.
-- ----------------------------------------------------------------------------
create table if not exists user_stats (
  user_id    uuid primary key references profiles(id) on delete cascade,
  level      int not null default 1,
  exp        int not null default 0,     -- 누적 경험치 총량
  str        int not null default 0,
  agi        int not null default 0,
  sta        int not null default 0,
  unspent    int not null default 0,     -- 미배분 스탯 포인트
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. RLS — 본인 행만 읽기 (read own)
-- ----------------------------------------------------------------------------
alter table user_stats enable row level security;

-- create policy 는 IF NOT EXISTS 미지원 → drop+create 로 멱등화
drop policy if exists "read own stats" on user_stats;
create policy "read own stats" on user_stats for select
  to authenticated using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. grant — select 만. insert/update/delete 는 주지 않는다.
--    RLS 와 grant 둘 다로 직접 쓰기를 차단(스탯 자가조작 방지). 변경은 RPC 전용.
-- ----------------------------------------------------------------------------
grant select on user_stats to authenticated;

-- ----------------------------------------------------------------------------
-- 4. apply_game_result — 서버 검증 RPC (치팅 방지의 핵심, §16-2)
--    security definer + set search_path=public. 서버가 경험치를 직접 계산하고
--    스탯 배분을 미배분 포인트 예산으로 캡한다. auth.uid() 로 대상 유저 확정.
-- ----------------------------------------------------------------------------
create or replace function public.apply_game_result(
  p_kills_weak   int,
  p_kills_mid    int,
  p_kills_strong int,
  p_alloc_str    int,
  p_alloc_agi    int,
  p_alloc_sta    int
) returns user_stats
language plpgsql security definer set search_path = public as $$
declare
  v_uid        uuid := auth.uid();
  -- 입력 킬 수 음수 방어 (greatest(0, ...))
  v_kw         int  := greatest(0, coalesce(p_kills_weak, 0));
  v_km         int  := greatest(0, coalesce(p_kills_mid, 0));
  v_ks         int  := greatest(0, coalesce(p_kills_strong, 0));
  v_as         int  := coalesce(p_alloc_str, 0);
  v_aa         int  := coalesce(p_alloc_agi, 0);
  v_at         int  := coalesce(p_alloc_sta, 0);
  v_row        user_stats;
  v_exp_gain   int;
  v_new_exp    int;
  v_new_level  int;
  v_remaining  int;
  v_need       int;
  v_points     int;
  v_alloc_sum  int;
begin
  -- 로그인 필수 (security definer 함수라 호출 주체를 반드시 확인)
  if v_uid is null then
    raise exception 'apply_game_result: auth.uid() is null (로그인 필요)';
  end if;

  -- 배분 음수 방어 (예산 검증 전 선제 거부)
  if v_as < 0 or v_aa < 0 or v_at < 0 then
    raise exception '스탯 배분은 음수일 수 없습니다 (str=%, agi=%, sta=%)', v_as, v_aa, v_at;
  end if;

  -- 대상 행 확보(없으면 default 로 생성) 후 잠금 — 동시 저장 직렬화
  insert into user_stats (user_id) values (v_uid)
    on conflict (user_id) do nothing;
  select * into v_row from user_stats where user_id = v_uid for update;

  -- 경험치는 서버가 킬 수에서 직접 계산 (클라가 exp 를 못 부풀림) — EXP_BY_TIER 와 일치
  v_exp_gain := v_kw * 1 + v_km * 3 + v_ks * 8;
  v_new_exp  := v_row.exp + v_exp_gain;

  -- 레벨 재계산 루프 (growth.ts levelForExp 와 동일 알고리즘)
  --   level=1 부터 while remaining >= round(25*level^1.5) 만큼 차감하며 레벨업
  v_new_level := 1;
  v_remaining := v_new_exp;
  v_need      := round(25 * power(v_new_level, 1.5))::int;
  while v_remaining >= v_need loop
    v_remaining := v_remaining - v_need;
    v_new_level := v_new_level + 1;
    v_need      := round(25 * power(v_new_level, 1.5))::int;
  end loop;

  -- 레벨업으로 얻은 포인트 (레벨당 1, 음수 불가) → 미배분에 적립
  v_points      := greatest(0, v_new_level - v_row.level);
  v_row.unspent := v_row.unspent + v_points;

  -- 예산 검증: 이번 배분 합이 보유 미배분 포인트를 넘으면 무효
  v_alloc_sum := v_as + v_aa + v_at;
  if v_alloc_sum > v_row.unspent then
    raise exception '배분 합(%)이 미배분 포인트(%)를 초과합니다', v_alloc_sum, v_row.unspent;
  end if;

  -- 적용: 스탯 증가 · 미배분 차감 · 레벨/경험치 갱신
  update user_stats set
    str        = str + v_as,
    agi        = agi + v_aa,
    sta        = sta + v_at,
    unspent    = v_row.unspent - v_alloc_sum,
    level      = v_new_level,
    exp        = v_new_exp,
    updated_at = now()
  where user_id = v_uid
  returning * into v_row;

  return v_row;
end $$;

-- ----------------------------------------------------------------------------
-- 5·6. grant execute — 로그인 유저만. security definer 함수는 public 스키마에서
--     기본적으로 PUBLIC(anon 포함)에 실행 권한이 열리므로 먼저 회수 후 부여.
-- ----------------------------------------------------------------------------
revoke execute on function public.apply_game_result(int, int, int, int, int, int) from public, anon;
grant  execute on function public.apply_game_result(int, int, int, int, int, int) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. handle_new_user — 기존 profiles insert 로직 유지 + user_stats 행 함께 생성
--    (01-init.sql 의 본문을 그대로 보존하고 끝에 user_stats insert 만 추가)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, country)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', '플레이어'),
    coalesce(new.raw_user_meta_data ->> 'country', 'KR')
  );
  insert into public.user_stats (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 8. 백필 — 기존 유저(profiles) 전원에게 default user_stats 행 생성
-- ----------------------------------------------------------------------------
insert into user_stats (user_id) select id from profiles on conflict do nothing;
