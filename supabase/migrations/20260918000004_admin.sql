-- 운영자 화면. 클로즈드 베타의 출시 조건이 "첫 게시 완주율 40%" 이므로
-- 관리자 화면의 1순위는 그 깔때기를 보는 것이다.
--
-- 집계는 RLS 를 넘어 여러 사용자를 가로질러야 하므로 security definer 함수로만 연다.
-- 함수 안에서 is_admin 을 먼저 확인한다.

alter table public.profiles
  add column is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

-- 가입 → 캐릭터 → 사연 → 첫 화 완성 → 첫 게시.
-- 각 단계를 "지나간 사용자 수"로 센다.
create or replace function public.admin_funnel()
returns table (step text, users bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '운영자만 볼 수 있습니다' using errcode = 'SK004';
  end if;

  return query
    select '가입'::text, count(*)::bigint from public.profiles
  union all
    select '캐릭터 만듦', count(distinct a.owner_id)
      from public.assets a where a.kind = 'character'
  union all
    select '사연 입력', count(distinct e.owner_id) from public.episodes e
  union all
    select '첫 화 완성', count(distinct e.owner_id)
      from public.episodes e where e.status in ('ready', 'published')
  union all
    select '첫 게시', count(distinct e.owner_id)
      from public.episodes e where e.status = 'published';
end;
$$;

-- 생성 실패는 반드시 크레딧 환불로 이어진다. 그래서 환불된 hold 비율이 곧 실패율이다.
create or replace function public.admin_generation_stats()
returns table (holds bigint, refunded bigint, spent numeric, refunded_amount numeric, granted numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '운영자만 볼 수 있습니다' using errcode = 'SK004';
  end if;

  return query
  select
    (select count(*) from public.credit_holds),
    (select count(*) from public.credit_holds h where h.status = 'refunded'),
    coalesce((select -sum(t.amount) from public.credit_transactions t where t.amount < 0), 0),
    coalesce((select sum(t.amount) from public.credit_transactions t
               where t.earn_reason = 'generation_refund'), 0),
    coalesce((select sum(t.amount) from public.credit_transactions t
               where t.amount > 0 and t.earn_reason <> 'generation_refund'), 0);
end;
$$;

create or replace function public.admin_recent_refunds(p_limit integer default 20)
returns table (id bigint, user_id uuid, amount numeric, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '운영자만 볼 수 있습니다' using errcode = 'SK004';
  end if;

  return query
  select t.id, t.user_id, t.amount, t.created_at
    from public.credit_transactions t
   where t.earn_reason = 'generation_refund'
   order by t.created_at desc
   limit p_limit;
end;
$$;

revoke all on function public.admin_funnel() from public;
revoke all on function public.admin_generation_stats() from public;
revoke all on function public.admin_recent_refunds(integer) from public;
revoke all on function public.is_admin() from public;

grant execute on function public.admin_funnel() to authenticated;
grant execute on function public.admin_generation_stats() to authenticated;
grant execute on function public.admin_recent_refunds(integer) to authenticated;
grant execute on function public.is_admin() to authenticated;
