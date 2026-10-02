-- 크레딧을 종류별 묶음(lot)으로 나눈다 — 결제를 열기 전에 약관과 원장을 맞추는 작업.
--
-- 약관(제8조·제14조)이 약속한 것:
--   - 무상 → 구독 → 구매 순으로 차감한다(이용자에게 유리한 순서).
--   - 구독 크레딧은 다음 달에 한하여 50% 이월한다.
--   - 구매 크레딧은 5년 유효, 무상 크레딧은 정한 기간만 유효.
--   - 탈퇴·해지 때 사용하지 않은 유료 크레딧은 10% 를 공제하고 환불한다.
-- 잔량 하나만 있는 원장으로는 이걸 계산할 수 없다. 얼마에 산 크레딧이 몇 개 남았는지가 필요하다.
--
-- 지켜지는 식:
--   credit_accounts.balance = sum(credit_lots.remaining)          (만료 처리된 묶음은 remaining 0)
--   credit_accounts.balance = sum(credit_transactions.amount)     (0002 부터의 원장 정합)

alter type credit_spend_reason add value if not exists 'expiry';
alter type credit_spend_reason add value if not exists 'refund_payout';

create type credit_lot_kind as enum ('free', 'subscription', 'purchase');
create type payment_status as enum ('paid', 'cancelled', 'refunded', 'partially_refunded');
create type refund_request_status as enum ('requested', 'approved', 'rejected');

-- 크레딧 정책. 출석 보상량처럼 운영하며 바꾸는 값은 마이그레이션 없이 고친다.
-- 기본값은 2026-10-03 요금 모델(docs/요금제_모델.md)의 제안이다.
create table public.credit_policy (
  id boolean primary key default true check (id),
  signup_bonus numeric(8, 1) not null default 8,
  attendance_daily numeric(8, 1) not null default 0.5,
  attendance_streak_days integer not null default 7,
  attendance_streak_bonus numeric(8, 1) not null default 1,
  -- 출석으로 한 달(서울 기준)에 받을 수 있는 최대치. 무료 사용자 원가의 상한이다.
  attendance_monthly_cap numeric(8, 1) not null default 3,
  free_credit_days integer not null default 90,
  purchase_credit_years integer not null default 5,
  -- 중도 해지 환불 공제율(콘텐츠이용자보호지침).
  refund_fee_rate numeric(4, 3) not null default 0.1,
  updated_at timestamptz not null default now()
);
insert into public.credit_policy default values;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- manual 은 운영자가 직접 지급한 것(베타 테스터, 계좌이체 등).
  provider text not null check (provider in ('toss', 'apple', 'google', 'manual')),
  product text not null,
  amount_krw integer not null check (amount_krw >= 0),
  status payment_status not null default 'paid',
  provider_ref text unique,
  paid_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create table public.credit_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind credit_lot_kind not null,
  amount numeric(8, 1) not null check (amount > 0),
  remaining numeric(8, 1) not null check (remaining >= 0 and remaining <= amount),
  -- 1크레딧당 결제 금액(원, VAT 포함). 무상은 0. 환불 계산의 근거다.
  unit_price numeric(10, 2) not null default 0 check (unit_price >= 0),
  earn_reason credit_earn_reason not null,
  payment_id uuid references public.payments (id) on delete set null,
  -- 구독 이월분은 한 번만 이월된다(약관 제8조 제4항).
  is_rollover boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index credit_lots_user_idx on public.credit_lots (user_id, kind, expires_at);

-- hold 가 어느 묶음에서 얼마를 가져갔는지. 환불하면 같은 묶음으로 돌려준다.
create table public.credit_hold_lots (
  hold_id uuid not null references public.credit_holds (id) on delete cascade,
  lot_id uuid not null references public.credit_lots (id) on delete cascade,
  amount numeric(8, 1) not null check (amount > 0),
  primary key (hold_id, lot_id)
);

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  credits numeric(8, 1) not null,
  gross_krw integer not null,
  fee_krw integer not null,
  net_krw integer not null,
  reason text,
  status refund_request_status not null default 'requested',
  note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index refund_requests_one_open on public.refund_requests (user_id) where status = 'requested';

-- 탈퇴 요청. 30일 안에는 철회할 수 있고, 지나면 운영 배치가 계정과 파일을 지운다(약관 제14조).
alter table public.profiles add column deletion_requested_at timestamptz;

alter table public.credit_policy enable row level security;
alter table public.payments enable row level security;
alter table public.credit_lots enable row level security;
alter table public.credit_hold_lots enable row level security;
alter table public.refund_requests enable row level security;

create policy "정책 조회" on public.credit_policy for select using (true);
create policy "본인 결제 조회" on public.payments for select using (auth.uid() = user_id);
create policy "본인 크레딧 묶음 조회" on public.credit_lots for select using (auth.uid() = user_id);
create policy "본인 환불 요청 조회" on public.refund_requests for select using (auth.uid() = user_id);

-- 값이 바뀌는 길은 아래 함수뿐이다.
revoke insert, update, delete on public.credit_policy, public.payments, public.credit_lots,
  public.credit_hold_lots, public.refund_requests from anon, authenticated;
revoke select on public.credit_hold_lots from anon, authenticated;

-- 기존 잔량은 무상 묶음으로 옮긴다. 아직 결제가 열린 적이 없으므로 전부 무상이다.
-- 거래는 이미 원장에 있으므로 새로 쓰지 않는다.
insert into public.credit_lots (user_id, kind, amount, remaining, earn_reason, expires_at)
select user_id, 'free', balance, balance, 'signup_bonus', now() + interval '90 days'
  from public.credit_accounts
 where balance > 0;

-- ── 내부 함수 ──────────────────────────────────────────────────────────

/** 묶음을 하나 더하고 잔량·원장을 맞춘다. 돌려주는 값은 새 잔량. */
create or replace function public._credit_add_lot(
  p_user uuid,
  p_kind credit_lot_kind,
  p_amount numeric,
  p_unit_price numeric,
  p_reason credit_earn_reason,
  p_expires_at timestamptz,
  p_payment_id uuid default null,
  p_is_rollover boolean default false
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(8, 1);
begin
  if p_amount <= 0 then
    return (select balance from public.credit_accounts where user_id = p_user);
  end if;

  insert into public.credit_lots (user_id, kind, amount, remaining, unit_price, earn_reason, payment_id, is_rollover, expires_at)
  values (p_user, p_kind, p_amount, p_amount, p_unit_price, p_reason, p_payment_id, p_is_rollover, p_expires_at);

  update public.credit_accounts
     set balance = balance + p_amount, updated_at = now()
   where user_id = p_user
  returning balance into v_balance;

  insert into public.credit_transactions (user_id, amount, earn_reason, balance_after)
  values (p_user, p_amount, p_reason, v_balance);

  return v_balance;
end;
$$;

/** 기한이 지난 묶음을 0 으로 만들고 만료 거래를 남긴다. 사용자 한 명 분. */
create or replace function public._credit_expire_user(p_user uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot record;
  v_total numeric(8, 1) := 0;
  v_balance numeric(8, 1);
begin
  for v_lot in
    select id, remaining from public.credit_lots
     where user_id = p_user and remaining > 0 and expires_at is not null and expires_at <= now()
     for update
  loop
    update public.credit_lots set remaining = 0 where id = v_lot.id;
    v_total := v_total + v_lot.remaining;
  end loop;

  if v_total > 0 then
    update public.credit_accounts
       set balance = balance - v_total, updated_at = now()
     where user_id = p_user
    returning balance into v_balance;

    insert into public.credit_transactions (user_id, amount, spend_reason, balance_after)
    values (p_user, -v_total, 'expiry', v_balance);
  end if;

  return v_total;
end;
$$;

-- ── 정산(서비스 롤 전용, 0005 를 묶음 기준으로 다시 쓴다) ─────────────────

create or replace function public.credit_hold(
  p_user_id uuid,
  p_amount numeric,
  p_reason credit_spend_reason,
  p_job_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(8, 1);
  v_hold uuid;
  v_need numeric(8, 1) := p_amount;
  v_take numeric(8, 1);
  v_lot record;
begin
  if p_user_id is null then
    raise exception '사용자가 필요합니다' using errcode = '22023';
  end if;
  if p_amount <= 0 then
    raise exception '크레딧은 0보다 커야 합니다' using errcode = '22023';
  end if;

  -- 계정 행을 잠가 같은 사용자의 hold 가 동시에 묶음을 나눠 가지지 않게 한다.
  perform 1 from public.credit_accounts where user_id = p_user_id for update;
  perform public._credit_expire_user(p_user_id);

  update public.credit_accounts
     set balance = balance - p_amount,
         held = held + p_amount,
         updated_at = now()
   where user_id = p_user_id
     and balance >= p_amount
  returning balance into v_balance;

  if v_balance is null then
    raise exception '크레딧이 부족합니다' using errcode = 'SK001';
  end if;

  insert into public.credit_holds (user_id, amount, reason, job_id)
  values (p_user_id, p_amount, p_reason, p_job_id)
  returning id into v_hold;

  -- 무상 → 구독 → 구매, 같은 종류 안에서는 먼저 만료되는 것부터.
  for v_lot in
    select id, remaining from public.credit_lots
     where user_id = p_user_id and remaining > 0
       and (expires_at is null or expires_at > now())
     order by case kind when 'free' then 0 when 'subscription' then 1 else 2 end,
              expires_at nulls last, created_at
     for update
  loop
    exit when v_need <= 0;
    v_take := least(v_need, v_lot.remaining);
    update public.credit_lots set remaining = remaining - v_take where id = v_lot.id;
    insert into public.credit_hold_lots (hold_id, lot_id, amount) values (v_hold, v_lot.id, v_take);
    v_need := v_need - v_take;
  end loop;

  if v_need > 0 then
    -- 잔량과 묶음이 어긋났다. 원장이 틀어진 것이므로 진행하지 않는다.
    raise exception '크레딧 묶음이 잔량과 맞지 않습니다' using errcode = 'SK005';
  end if;

  insert into public.credit_transactions (user_id, amount, spend_reason, hold_id, balance_after)
  values (p_user_id, -p_amount, p_reason, v_hold, v_balance);

  return v_hold;
end;
$$;

create or replace function public.credit_refund(p_hold_id uuid, p_reason text default '생성 실패')
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.credit_holds;
  v_balance numeric(8, 1);
  v_part record;
  v_restored numeric(8, 1) := 0;
begin
  update public.credit_holds
     set status = 'refunded', resolved_at = now()
   where id = p_hold_id and status = 'held'
  returning * into v_hold;

  if v_hold.id is null then
    raise exception '이미 정산되었거나 없는 hold 입니다' using errcode = 'SK002';
  end if;

  -- 가져갔던 묶음으로 돌려준다. 그 사이 기한이 지났으면 다음 만료 처리에서 빠진다.
  for v_part in select lot_id, amount from public.credit_hold_lots where hold_id = v_hold.id loop
    update public.credit_lots set remaining = remaining + v_part.amount where id = v_part.lot_id;
    v_restored := v_restored + v_part.amount;
  end loop;

  -- 묶음 기록이 없는 hold(0008 이전에 걸린 것)는 무상 묶음으로 돌려준다.
  if v_restored < v_hold.amount then
    insert into public.credit_lots (user_id, kind, amount, remaining, earn_reason, expires_at)
    values (v_hold.user_id, 'free', v_hold.amount - v_restored, v_hold.amount - v_restored,
            'generation_refund', now() + interval '90 days');
  end if;

  update public.credit_accounts
     set balance = balance + v_hold.amount,
         held = held - v_hold.amount,
         updated_at = now()
   where user_id = v_hold.user_id
  returning balance into v_balance;

  insert into public.credit_transactions (user_id, amount, earn_reason, hold_id, balance_after)
  values (v_hold.user_id, v_hold.amount, 'generation_refund', v_hold.id, v_balance);

  return v_hold.amount;
end;
$$;

/** 결제·구독·운영 지급. 결제 웹훅(서비스 롤)이 부른다. */
create or replace function public.credit_grant(
  p_user_id uuid,
  p_kind credit_lot_kind,
  p_amount numeric,
  p_unit_price numeric,
  p_reason credit_earn_reason,
  p_payment_id uuid default null,
  p_expires_at timestamptz default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.credit_policy;
  v_expires timestamptz := p_expires_at;
begin
  select * into v_policy from public.credit_policy;
  if v_expires is null then
    v_expires := case p_kind
      when 'purchase' then now() + make_interval(years => v_policy.purchase_credit_years)
      when 'free' then now() + make_interval(days => v_policy.free_credit_days)
      else null
    end;
  end if;
  if p_kind = 'subscription' and v_expires is null then
    raise exception '구독 크레딧에는 기간 끝이 필요합니다' using errcode = '22023';
  end if;
  perform 1 from public.credit_accounts where user_id = p_user_id for update;
  return public._credit_add_lot(p_user_id, p_kind, p_amount, p_unit_price, p_reason, v_expires, p_payment_id);
end;
$$;

/**
 * 새 구독 기간 시작. 지난 기간의 남은 구독 크레딧은 50% 만 이번 기간 끝까지 이월하고
 * 나머지는 만료한다. 이월분은 다시 이월되지 않는다(약관 제8조 제4항).
 */
create or replace function public.credit_start_subscription_period(
  p_user_id uuid,
  p_amount numeric,
  p_unit_price numeric,
  p_payment_id uuid,
  p_period_end timestamptz
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot record;
  v_carry numeric(8, 1) := 0;
  v_expired numeric(8, 1) := 0;
  v_unit numeric(10, 2) := 0;
  v_balance numeric(8, 1);
begin
  perform 1 from public.credit_accounts where user_id = p_user_id for update;

  for v_lot in
    select id, remaining, unit_price, is_rollover from public.credit_lots
     where user_id = p_user_id and kind = 'subscription' and remaining > 0
     for update
  loop
    if not v_lot.is_rollover then
      -- 0.5 크레딧 단위로 내림.
      v_carry := v_carry + floor(v_lot.remaining) / 2;
      v_unit := greatest(v_unit, v_lot.unit_price);
    end if;
    v_expired := v_expired + v_lot.remaining;
    update public.credit_lots set remaining = 0 where id = v_lot.id;
  end loop;

  if v_expired > 0 then
    update public.credit_accounts set balance = balance - v_expired, updated_at = now()
     where user_id = p_user_id returning balance into v_balance;
    insert into public.credit_transactions (user_id, amount, spend_reason, balance_after)
    values (p_user_id, -v_expired, 'expiry', v_balance);
  end if;

  if v_carry > 0 then
    perform public._credit_add_lot(p_user_id, 'subscription', v_carry, v_unit, 'monthly_rollover',
                                   p_period_end, null, true);
  end if;

  return public._credit_add_lot(p_user_id, 'subscription', p_amount, p_unit_price, 'subscription_grant',
                                p_period_end, p_payment_id);
end;
$$;

/** 만료 배치. 운영 크론이 하루 한 번 부른다. 처리한 크레딧 합계를 돌려준다. */
create or replace function public.credit_expire_all()
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_total numeric := 0;
begin
  for v_user in
    select distinct user_id from public.credit_lots
     where remaining > 0 and expires_at is not null and expires_at <= now()
  loop
    perform 1 from public.credit_accounts where user_id = v_user for update;
    v_total := v_total + public._credit_expire_user(v_user);
  end loop;
  return v_total;
end;
$$;

-- ── 사용자가 부르는 함수 ───────────────────────────────────────────────

-- 출석: 정책 테이블 값을 따르고, 한 달 상한을 넘겨 주지 않는다.
-- 상한에 닿아도 출석과 연속 일수는 기록한다 — 연속 출석 자체가 습관 장치다.
create or replace function public.attendance_check_in()
returns table (streak integer, granted numeric, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_policy public.credit_policy;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_prev integer;
  v_streak integer;
  v_earned numeric(8, 1);
  v_want numeric(8, 1);
  v_daily numeric(8, 1);
  v_bonus numeric(8, 1) := 0;
  v_balance numeric(8, 1);
begin
  if v_user is null then
    raise exception '로그인이 필요합니다' using errcode = '28000';
  end if;
  select * into v_policy from public.credit_policy;

  if exists (select 1 from public.attendance a where a.user_id = v_user and a.attended_on = v_today) then
    raise exception '오늘은 이미 출석했습니다' using errcode = 'SK003';
  end if;

  select a.streak into v_prev from public.attendance a
   where a.user_id = v_user and a.attended_on = v_today - 1;
  v_streak := coalesce(v_prev, 0) + 1;

  insert into public.attendance (user_id, attended_on, streak) values (v_user, v_today, v_streak);

  perform 1 from public.credit_accounts where user_id = v_user for update;

  select coalesce(sum(t.amount), 0) into v_earned
    from public.credit_transactions t
   where t.user_id = v_user
     and t.earn_reason in ('attendance_daily', 'attendance_streak')
     and t.created_at >= v_month_start;

  v_daily := least(v_policy.attendance_daily, greatest(0, v_policy.attendance_monthly_cap - v_earned));
  if v_streak % v_policy.attendance_streak_days = 0 then
    v_bonus := least(v_policy.attendance_streak_bonus,
                     greatest(0, v_policy.attendance_monthly_cap - v_earned - v_daily));
  end if;

  if v_daily > 0 then
    perform public._credit_add_lot(v_user, 'free', v_daily, 0, 'attendance_daily',
                                   now() + make_interval(days => v_policy.free_credit_days));
  end if;
  if v_bonus > 0 then
    perform public._credit_add_lot(v_user, 'free', v_bonus, 0, 'attendance_streak',
                                   now() + make_interval(days => v_policy.free_credit_days));
  end if;

  select a.balance into v_balance from public.credit_accounts a where a.user_id = v_user;
  return query select v_streak, v_daily + v_bonus, v_balance;
end;
$$;

/**
 * 환불 견적. 기한이 남은 구독·구매 묶음의 남은 크레딧 × 산 단가. 공제율을 빼되,
 * 결제 7일 안이고 그 결제로 받은 크레딧을 하나도 안 썼으면 공제하지 않는다(약관 제14조 제3항).
 */
create or replace function public.credit_refund_quote()
returns table (credits numeric, gross_krw integer, fee_krw integer, net_krw integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_rate numeric;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다' using errcode = '28000';
  end if;
  select refund_fee_rate into v_rate from public.credit_policy;

  return query
  with lots as (
    select l.remaining,
           l.remaining * l.unit_price as value,
           (p.paid_at > now() - interval '7 days' and l.remaining = l.amount) as exempt
      from public.credit_lots l
      left join public.payments p on p.id = l.payment_id
     where l.user_id = v_user
       and l.kind in ('subscription', 'purchase')
       and l.remaining > 0
       and l.unit_price > 0
       and (l.expires_at is null or l.expires_at > now())
  )
  select coalesce(sum(remaining), 0)::numeric,
         coalesce(floor(sum(value)), 0)::integer,
         coalesce(floor(sum(case when exempt then 0 else value * v_rate end)), 0)::integer,
         (coalesce(floor(sum(value)), 0) - coalesce(floor(sum(case when exempt then 0 else value * v_rate end)), 0))::integer
    from lots;
end;
$$;

/** 환불 신청. 견적을 그 시점 값으로 남긴다. 실제 지급은 운영자가 승인한 뒤 결제 취소로 한다. */
create or replace function public.request_credit_refund(p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_quote record;
  v_id uuid;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다' using errcode = '28000';
  end if;
  select * into v_quote from public.credit_refund_quote();
  if v_quote.net_krw <= 0 then
    raise exception '환불할 유료 크레딧이 없습니다' using errcode = 'SK006';
  end if;
  insert into public.refund_requests (user_id, credits, gross_krw, fee_krw, net_krw, reason)
  values (v_user, v_quote.credits, v_quote.gross_krw, v_quote.fee_krw, v_quote.net_krw, left(p_reason, 500))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception '이미 처리 중인 환불 신청이 있습니다' using errcode = 'SK007';
end;
$$;

create or replace function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '28000';
  end if;
  update public.profiles set deletion_requested_at = coalesce(deletion_requested_at, now())
   where id = auth.uid();
  return (select deletion_requested_at + interval '30 days' from public.profiles where id = auth.uid());
end;
$$;

create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set deletion_requested_at = null where id = auth.uid();
end;
$$;

-- ── 운영자 ────────────────────────────────────────────────────────────

/** 환불 승인·거절. 승인하면 유료 묶음을 비우고 지급 거래를 남긴다. 돈은 결제 취소로 나간다. */
create or replace function public.admin_process_refund(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.refund_requests;
  v_total numeric(8, 1) := 0;
  v_lot record;
  v_balance numeric(8, 1);
begin
  if not public.is_admin() then
    raise exception '운영자만 할 수 있습니다' using errcode = 'SK004';
  end if;
  select * into v_req from public.refund_requests where id = p_id and status = 'requested' for update;
  if v_req.id is null then
    raise exception '처리할 환불 신청이 없습니다' using errcode = 'SK002';
  end if;

  if p_approve then
    perform 1 from public.credit_accounts where user_id = v_req.user_id for update;
    for v_lot in
      select id, remaining from public.credit_lots
       where user_id = v_req.user_id and kind in ('subscription', 'purchase')
         and remaining > 0 and unit_price > 0
         and (expires_at is null or expires_at > now())
       for update
    loop
      update public.credit_lots set remaining = 0 where id = v_lot.id;
      v_total := v_total + v_lot.remaining;
    end loop;
    if v_total > 0 then
      update public.credit_accounts set balance = balance - v_total, updated_at = now()
       where user_id = v_req.user_id returning balance into v_balance;
      insert into public.credit_transactions (user_id, amount, spend_reason, balance_after)
      values (v_req.user_id, -v_total, 'refund_payout', v_balance);
    end if;
  end if;

  update public.refund_requests
     set status = case when p_approve then 'approved'::refund_request_status else 'rejected'::refund_request_status end,
         note = p_note, processed_at = now()
   where id = p_id;
end;
$$;

/** 운영자 수동 지급(베타 테스터, 계좌이체 결제). 결제 기록과 구매 묶음을 같이 만든다. */
create or replace function public.admin_grant_purchase(
  p_user_id uuid,
  p_credits numeric,
  p_amount_krw integer,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment uuid;
begin
  if not public.is_admin() then
    raise exception '운영자만 할 수 있습니다' using errcode = 'SK004';
  end if;
  insert into public.payments (user_id, provider, product, amount_krw, note)
  values (p_user_id, 'manual', 'manual_grant', p_amount_krw, p_note)
  returning id into v_payment;
  return public.credit_grant(p_user_id, 'purchase'::credit_lot_kind, p_credits,
                             case when p_credits > 0 then p_amount_krw / p_credits else 0 end,
                             (case when p_amount_krw > 0 then 'credit_pack' else 'subscription_grant' end)::credit_earn_reason,
                             v_payment);
end;
$$;

create or replace function public.admin_list_refund_requests()
returns table (id uuid, user_id uuid, credits numeric, net_krw integer, fee_krw integer, reason text,
               status refund_request_status, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '운영자만 볼 수 있습니다' using errcode = 'SK004';
  end if;
  return query
  select r.id, r.user_id, r.credits, r.net_krw, r.fee_krw, r.reason, r.status, r.created_at
    from public.refund_requests r
   order by (r.status = 'requested') desc, r.created_at desc
   limit 50;
end;
$$;

-- 가입 트리거: 가입 보너스를 정책 값으로, 무상 묶음으로 준다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.credit_policy;
begin
  select * into v_policy from public.credit_policy;

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.credit_accounts (user_id, balance) values (new.id, 0);

  perform public._credit_add_lot(new.id, 'free', v_policy.signup_bonus, 0, 'signup_bonus',
                                 now() + make_interval(days => v_policy.free_credit_days));
  return new;
end;
$$;

-- 권한. 내부 함수와 정산·지급은 서비스 롤만, 사용자 함수는 로그인한 사용자만.
revoke all on function public._credit_add_lot(uuid, credit_lot_kind, numeric, numeric, credit_earn_reason, timestamptz, uuid, boolean) from public, anon, authenticated;
revoke all on function public._credit_expire_user(uuid) from public, anon, authenticated;
revoke all on function public.credit_hold(uuid, numeric, credit_spend_reason, text) from public, anon, authenticated;
revoke all on function public.credit_refund(uuid, text) from public, anon, authenticated;
revoke all on function public.credit_grant(uuid, credit_lot_kind, numeric, numeric, credit_earn_reason, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.credit_start_subscription_period(uuid, numeric, numeric, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.credit_expire_all() from public, anon, authenticated;

grant execute on function public.credit_hold(uuid, numeric, credit_spend_reason, text) to service_role;
grant execute on function public.credit_refund(uuid, text) to service_role;
grant execute on function public.credit_grant(uuid, credit_lot_kind, numeric, numeric, credit_earn_reason, uuid, timestamptz) to service_role;
grant execute on function public.credit_start_subscription_period(uuid, numeric, numeric, uuid, timestamptz) to service_role;
grant execute on function public.credit_expire_all() to service_role;

revoke all on function public.attendance_check_in() from public, anon;
revoke all on function public.credit_refund_quote() from public, anon;
revoke all on function public.request_credit_refund(text) from public, anon;
revoke all on function public.request_account_deletion() from public, anon;
revoke all on function public.cancel_account_deletion() from public, anon;
revoke all on function public.admin_process_refund(uuid, boolean, text) from public, anon;
revoke all on function public.admin_grant_purchase(uuid, numeric, integer, text) from public, anon;
revoke all on function public.admin_list_refund_requests() from public, anon;

grant execute on function public.attendance_check_in() to authenticated;
grant execute on function public.credit_refund_quote() to authenticated;
grant execute on function public.request_credit_refund(text) to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.admin_process_refund(uuid, boolean, text) to authenticated;
grant execute on function public.admin_grant_purchase(uuid, numeric, integer, text) to authenticated;
grant execute on function public.admin_list_refund_requests() to authenticated;
