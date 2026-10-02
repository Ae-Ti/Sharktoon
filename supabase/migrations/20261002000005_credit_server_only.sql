-- 크레딧 정산을 서버 전용으로 옮긴다.
--
-- 0002 에서는 credit_hold / commit / refund 를 authenticated 에 열어 두었다.
-- 그러면 사용자가 브라우저에서 anon key 와 자기 토큰으로 생성 중인 hold 를 직접
-- refund 할 수 있다. 이미지는 받고 크레딧은 돌려받는 셈이다(2026-10-02 실 테스트에서 확인).
--
-- 정산은 생성 워커가 하는 일이다. 워커는 서비스 롤로 돌고, 누구의 크레딧인지는
-- 인자로 받는다. 세 함수 모두 authenticated·anon 에서 실행 권한을 뺀다.
--
-- Supabase 는 public 스키마의 새 함수에 anon·authenticated 실행 권한을 기본으로 준다.
-- `from public` 만 빼서는 안 막히므로 역할을 하나씩 적는다.

drop function if exists public.credit_hold(numeric, credit_spend_reason, text);

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
begin
  if p_user_id is null then
    raise exception '사용자가 필요합니다' using errcode = '22023';
  end if;

  if p_amount <= 0 then
    raise exception '크레딧은 0보다 커야 합니다' using errcode = '22023';
  end if;

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

  insert into public.credit_transactions (user_id, amount, spend_reason, hold_id, balance_after)
  values (p_user_id, -p_amount, p_reason, v_hold, v_balance);

  return v_hold;
end;
$$;

-- hold id 만으로 정산한다. 호출자가 서비스 롤뿐이라 소유자를 다시 확인하지 않는다.
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

revoke all on function public.credit_hold(uuid, numeric, credit_spend_reason, text) from public, anon, authenticated;
revoke all on function public.credit_commit(uuid) from public, anon, authenticated;
revoke all on function public.credit_refund(uuid, text) from public, anon, authenticated;

grant execute on function public.credit_hold(uuid, numeric, credit_spend_reason, text) to service_role;
grant execute on function public.credit_commit(uuid) to service_role;
grant execute on function public.credit_refund(uuid, text) to service_role;

-- 0002·0004 의 나머지 함수도 anon 에서는 뺀다. 로그인 없이 부를 일이 없다.
revoke all on function public.attendance_check_in() from anon;
revoke all on function public.admin_funnel() from anon;
revoke all on function public.admin_generation_stats() from anon;
revoke all on function public.admin_recent_refunds(integer) from anon;
revoke all on function public.is_admin() from anon;
