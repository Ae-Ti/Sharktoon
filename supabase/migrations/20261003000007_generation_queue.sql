-- 생성 큐 (오픈 이슈 11 결정: Supabase Postgres 를 큐로 쓴다).
--
-- 지금까지는 웹 서버 메모리 안에서 컷을 만들었다. 서버리스(Vercel)는 응답을 보내면 함수가
-- 꺼지므로 그대로 배포하면 생성이 중간에 죽는다. 그래서 "할 일"을 이 테이블에 적고,
-- 작업자가 꺼내 처리한다. 서버가 꺼져도 할 일은 남고, 다음 작업자가 이어서 한다.
--
-- pgmq 를 쓰지 않고 테이블을 직접 쓰는 이유:
--   - 컷마다 시도 기록(몇 번째 시도, 실패 사유, 환불 여부)이 화면에 그대로 필요하다.
--     pgmq 메시지는 꺼내면 사라지고, 사용자 RLS 로 읽게 할 수도 없다.
--   - 원리는 같다(FOR UPDATE SKIP LOCKED + 임대 시간). CI 의 맨 Postgres 에서도 돈다.
--
-- 한 행이 컷 한 번의 시도다. 다시 만들면 새 행을 넣는다. 화면은 컷마다 가장 최근 행을 본다.

create type generation_task_status as enum ('queued', 'running', 'done', 'failed');

create table public.generation_tasks (
  id bigint generated always as identity primary key,
  job_id text not null references public.generation_jobs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  cut_id text not null,
  index integer not null check (index between 1 and 10),
  -- 한 컷 모드의 제한 수정 동작. 크레딧 차감량이 이걸로 정해진다.
  intent text not null default 'regenerate',
  -- 이미지 지시문. 콘티 장면에서 만든다. 사용자가 고친 요청이 있으면 뒤에 붙는다.
  prompt text not null,
  attempt integer not null default 1,
  status generation_task_status not null default 'queued',
  -- 이 시도에 건 크레딧 hold. 작업자가 죽어서 다시 꺼낼 때 먼저 환불하는 데 쓴다.
  hold_id uuid references public.credit_holds (id) on delete set null,
  image_ref text,
  error text,
  -- 실패했을 때 쓴 크레딧을 돌려줬는지. hold 전에 막혔으면 false.
  refunded boolean not null default false,
  -- 작업자가 이 시각까지 쥐고 있다. 지나면 죽은 것으로 보고 다른 작업자가 가져간다.
  lease_until timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index generation_tasks_pick_idx on public.generation_tasks (status, created_at);
create index generation_tasks_job_idx on public.generation_tasks (job_id, cut_id, id desc);
create index generation_tasks_owner_idx on public.generation_tasks (owner_id, status);

-- 잡에 생성 컨텍스트를 둔다. 레퍼런스는 서명 URL(만료됨)이 아니라 에셋 id 로 두고
-- 작업자가 꺼낼 때 다시 서명한다. 컷 진행은 이제 tasks 가 원본이라 cuts 열은 지운다.
alter table public.generation_jobs
  add column context jsonb not null default '{}'::jsonb,
  drop column cuts;

alter table public.generation_tasks enable row level security;

create policy "본인 생성 작업 조회" on public.generation_tasks
  for select using (auth.uid() = owner_id);

revoke insert, update, delete on public.generation_tasks from anon, authenticated;

/**
 * 할 일을 꺼낸다. 작업자(서비스 롤)만 부른다.
 *
 * - 대기 중이거나, 실행 중인데 임대 시간이 지난(작업자가 죽은) 행을 오래된 순으로 고른다.
 * - 한 잡에서 동시에 도는 컷은 p_per_job 개까지. 이미지 API 에 한 사람이 몰리지 않게 한다.
 * - SKIP LOCKED: 작업자 여럿이 동시에 꺼내도 같은 행을 두 번 가져가지 않는다.
 */
create or replace function public.claim_generation_tasks(
  p_limit integer default 4,
  p_lease_seconds integer default 180,
  p_per_job integer default 2
)
returns setof public.generation_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with running as (
    select job_id, count(*) as n
      from public.generation_tasks
     where status = 'running' and lease_until > now()
     group by job_id
  ),
  ranked as (
    select t.id,
           row_number() over (partition by t.job_id order by t.created_at, t.id) as rn,
           coalesce(r.n, 0) as busy
      from public.generation_tasks t
      left join running r on r.job_id = t.job_id
     where t.status = 'queued'
        or (t.status = 'running' and t.lease_until <= now())
  ),
  picked as (
    select g.id
      from public.generation_tasks g
      join ranked k on k.id = g.id
     where k.rn + k.busy <= p_per_job
     order by g.created_at, g.id
     for update of g skip locked
     limit p_limit
  )
  update public.generation_tasks t
     set status = 'running',
         lease_until = now() + make_interval(secs => p_lease_seconds),
         started_at = now(),
         error = null
    from picked
   where t.id = picked.id
  returning t.*;
end;
$$;

revoke all on function public.claim_generation_tasks(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_generation_tasks(integer, integer, integer) to service_role;
