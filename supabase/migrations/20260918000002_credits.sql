-- 크레딧 원장. src/contracts/credit.ts 의 CreditLedger 가 이 함수들을 부른다.
--
-- hold  : 잔량에서 빼고 held 로 옮긴다. 소모 거래를 이때 기록한다.
-- commit: held 만 줄인다. 거래는 이미 기록되어 있다.
-- refund: 잔량으로 되돌리고 환불 거래를 기록한다.
--
-- 이렇게 두면 credit_transactions 의 합이 언제나 balance 와 같다.
-- 생성이 죽어도 원장이 틀어지지 않는 것이 이 구조의 목적이다.

create table public.credit_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance numeric(8, 1) not null default 0 check (balance >= 0),
  -- 생성 중이라 예약된 금액. balance 에는 이미 빠져 있다.
  held numeric(8, 1) not null default 0 check (held >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(8, 1) not null check (amount > 0),
  reason credit_spend_reason not null,
  -- 이 hold 를 만든 생성 잡. 환불 추적의 키.
  job_id text not null,
  status credit_hold_status not null default 'held',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index credit_holds_user_status_idx on public.credit_holds (user_id, status);
create index credit_holds_job_idx on public.credit_holds (job_id);

create table public.credit_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 소모는 음수, 획득은 양수.
  amount numeric(8, 1) not null check (amount <> 0),
  spend_reason credit_spend_reason,
  earn_reason credit_earn_reason,
  hold_id uuid references public.credit_holds (id) on delete set null,
  balance_after numeric(8, 1) not null,
  created_at timestamptz not null default now(),
  constraint credit_transactions_reason_check check (
    (amount < 0 and spend_reason is not null and earn_reason is null)
    or (amount > 0 and earn_reason is not null and spend_reason is null)
  )
);

create index credit_transactions_user_idx on public.credit_transactions (user_id, created_at desc);

create table public.attendance (
  user_id uuid not null references public.profiles (id) on delete cascade,
  attended_on date not null,
  -- 연속 출석 일수. 7 의 배수마다 보너스 3크레딧.
  streak integer not null check (streak > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, attended_on)
);

alter table public.credit_accounts enable row level security;
alter table public.credit_holds enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.attendance enable row level security;

-- 원장은 읽기만 허용한다. 값이 바뀌는 길은 아래 함수뿐이다.
create policy "본인 크레딧 조회" on public.credit_accounts
  for select using (auth.uid() = user_id);

create policy "본인 hold 조회" on public.credit_holds
  for select using (auth.uid() = user_id);

create policy "본인 거래내역 조회" on public.credit_transactions
  for select using (auth.uid() = user_id);

create policy "본인 출석 조회" on public.attendance
  for select using (auth.uid() = user_id);

-- 크레딧이 부족할 때 던지는 코드. 앱에서 InsufficientCreditError 로 바꾼다.
-- SQLSTATE SK001
create or replace function public.credit_hold(
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
  v_user uuid := auth.uid();
  v_balance numeric(8, 1);
  v_hold uuid;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다' using errcode = '28000';
  end if;

  if p_amount <= 0 then
    raise exception '크레딧은 0보다 커야 합니다' using errcode = '22023';
  end if;

  update public.credit_accounts
     set balance = balance - p_amount,
         held = held + p_amount,
         updated_at = now()
   where user_id = v_user
     and balance >= p_amount
  returning balance into v_balance;

  if v_balance is null then
    raise exception '크레딧이 부족합니다' using errcode = 'SK001';
  end if;

  insert into public.credit_holds (user_id, amount, reason, job_id)
  values (v_user, p_amount, p_reason, p_job_id)
  returning id into v_hold;

  insert into public.credit_transactions (user_id, amount, spend_reason, hold_id, balance_after)
  values (v_user, -p_amount, p_reason, v_hold, v_balance);

  return v_hold;
end;
$$;

create or replace function public.credit_commit(p_hold_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.credit_holds;
begin
  update public.credit_holds
     set status = 'committed',
         resolved_at = now()
   where id = p_hold_id
     and user_id = auth.uid()
     and status = 'held'
  returning * into v_hold;

  if v_hold.id is null then
    raise exception '이미 정산되었거나 없는 hold 입니다' using errcode = 'SK002';
  end if;

  update public.credit_accounts
     set held = held - v_hold.amount,
         updated_at = now()
   where user_id = v_hold.user_id;
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
begin
  update public.credit_holds
     set status = 'refunded',
         resolved_at = now()
   where id = p_hold_id
     and user_id = auth.uid()
     and status = 'held'
  returning * into v_hold;

  if v_hold.id is null then
    raise exception '이미 정산되었거나 없는 hold 입니다' using errcode = 'SK002';
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

-- 출석 체크: 하루 1크레딧, 7일 연속이면 보너스 3크레딧.
create or replace function public.attendance_check_in()
returns table (streak integer, granted numeric, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_prev integer;
  v_streak integer;
  v_granted numeric(8, 1) := 0;
  v_balance numeric(8, 1);
begin
  if v_user is null then
    raise exception '로그인이 필요합니다' using errcode = '28000';
  end if;

  if exists (select 1 from public.attendance a where a.user_id = v_user and a.attended_on = v_today) then
    raise exception '오늘은 이미 출석했습니다' using errcode = 'SK003';
  end if;

  select a.streak into v_prev
    from public.attendance a
   where a.user_id = v_user
     and a.attended_on = v_today - 1;

  v_streak := coalesce(v_prev, 0) + 1;

  insert into public.attendance (user_id, attended_on, streak)
  values (v_user, v_today, v_streak);

  v_granted := 1;
  if v_streak % 7 = 0 then
    v_granted := v_granted + 3;
  end if;

  -- returns table 의 balance 출력 변수와 컬럼명이 겹치므로 테이블명으로 한정한다.
  update public.credit_accounts
     set balance = credit_accounts.balance + v_granted,
         updated_at = now()
   where user_id = v_user
  returning credit_accounts.balance into v_balance;

  insert into public.credit_transactions (user_id, amount, earn_reason, balance_after)
  values (v_user, 1, 'attendance_daily', v_balance - (v_granted - 1));

  if v_granted > 1 then
    insert into public.credit_transactions (user_id, amount, earn_reason, balance_after)
    values (v_user, 3, 'attendance_streak', v_balance);
  end if;

  return query select v_streak, v_granted, v_balance;
end;
$$;

revoke all on function public.credit_hold(numeric, credit_spend_reason, text) from public;
revoke all on function public.credit_commit(uuid) from public;
revoke all on function public.credit_refund(uuid, text) from public;
revoke all on function public.attendance_check_in() from public;

grant execute on function public.credit_hold(numeric, credit_spend_reason, text) to authenticated;
grant execute on function public.credit_commit(uuid) to authenticated;
grant execute on function public.credit_refund(uuid, text) to authenticated;
grant execute on function public.attendance_check_in() to authenticated;

-- 가입 즉시 프로필과 8크레딧을 만든다. 첫 화 결과 전에 결제를 묻지 않기 위해서다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.credit_accounts (user_id, balance) values (new.id, 8);

  insert into public.credit_transactions (user_id, amount, earn_reason, balance_after)
  values (new.id, 8, 'signup_bonus', 8);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
