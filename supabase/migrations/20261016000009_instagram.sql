-- 인스타그램 연동 (Instagram API with Instagram Login, graph.instagram.com).
--
-- 규격 근거: src/contracts/instagram.ts. 2026-10-16 기준 앱 심사(Advanced Access)·비즈니스 인증 전이라
-- 화면에서는 발행을 "출시 예정"으로 두고, 앱에 역할로 등록된 계정(Standard Access)으로만 시험한다.
--
--   instagram_accounts     : 사용자 1명당 연결된 프로페셔널 계정 1개와 암호화한 장기 토큰
--   instagram_publish_jobs : 발행 할 일. 즉시 발행도 예약 발행도 같은 행이다(API 에 예약 기능이 없다).
--   storage 'publish'      : Meta 가 가져갈 JPEG. 비공개 버킷이고 발행할 때만 서명 URL 을 넘긴다.

-- ─── 연결된 계정 ────────────────────────────────────────────────────────────
create table public.instagram_accounts (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  ig_user_id text not null,
  username text not null,
  -- BUSINESS | MEDIA_CREATOR. 개인 계정은 로그인 단계에서 막힌다.
  account_type text,
  -- AES-256-GCM(INSTAGRAM_TOKEN_KEY). 평문 토큰은 DB 에 두지 않는다.
  access_token_enc text not null,
  token_expires_at timestamptz not null,
  -- 장기 토큰은 발급 24시간 뒤부터 갱신할 수 있다. 60일 안에 갱신하지 않으면 다시 로그인해야 한다.
  token_refreshed_at timestamptz not null default now(),
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index instagram_accounts_ig_user_idx on public.instagram_accounts (ig_user_id);

create trigger instagram_accounts_updated_at
  before update on public.instagram_accounts
  for each row execute function public.set_updated_at();

alter table public.instagram_accounts enable row level security;

create policy "본인 인스타 계정 조회" on public.instagram_accounts
  for select using (auth.uid() = owner_id);

-- 토큰 열은 사용자에게 보이지 않는다. 쓰기는 서버(서비스 롤)만 한다.
revoke all on public.instagram_accounts from anon, authenticated;
grant select (owner_id, ig_user_id, username, account_type, token_expires_at, connected_at)
  on public.instagram_accounts to authenticated;

-- ─── 발행 할 일 ─────────────────────────────────────────────────────────────
create type instagram_publish_status as enum ('queued', 'running', 'published', 'failed', 'canceled');

create table public.instagram_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  status instagram_publish_status not null default 'queued',
  -- 이 시각이 지나면 작업자가 꺼낸다. 즉시 발행은 요청 시각이다.
  scheduled_at timestamptz not null default now(),
  -- publish 버킷 경로({owner}/{batch}/{n}.jpg). 1장이면 단일 이미지, 2~10장이면 캐러셀.
  image_paths text[] not null check (cardinality(image_paths) between 1 and 10),
  caption text not null default '' check (char_length(caption) <= 2200),
  first_comment text check (first_comment is null or char_length(first_comment) <= 2200),
  -- Meta 의 AI 정보 라벨(is_ai_generated). 캐러셀은 부모 컨테이너에만 붙는다.
  is_ai_generated boolean not null default true,
  -- 만든 컨테이너. 작업자가 중간에 죽으면 다음 작업자가 이어서 상태를 본다(24시간 뒤 만료).
  container_id text,
  container_created_at timestamptz,
  media_id text,
  permalink text,
  -- 첫 댓글은 게시와 따로 실패할 수 있다. 게시 자체는 성공으로 둔다.
  comment_error text,
  attempts integer not null default 0,
  error text,
  lease_until timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index instagram_publish_jobs_pick_idx on public.instagram_publish_jobs (status, scheduled_at);
create index instagram_publish_jobs_owner_idx on public.instagram_publish_jobs (owner_id, episode_id, created_at desc);

create trigger instagram_publish_jobs_updated_at
  before update on public.instagram_publish_jobs
  for each row execute function public.set_updated_at();

alter table public.instagram_publish_jobs enable row level security;

create policy "본인 발행 작업 조회" on public.instagram_publish_jobs
  for select using (auth.uid() = owner_id);

revoke insert, update, delete on public.instagram_publish_jobs from anon, authenticated;

/**
 * 발행할 일을 꺼낸다. 작업자(서비스 롤)만 부른다.
 * 예약 시각이 지난 대기 행, 또는 실행 중인데 임대가 지난(작업자가 죽은) 행을 오래된 순으로.
 * 한 계정에 동시에 하나만 돌린다 — 게시 한도와 컨테이너 상태 확인이 계정 단위라서다.
 */
create or replace function public.claim_instagram_publish_jobs(
  p_limit integer default 3,
  p_lease_seconds integer default 300
)
returns setof public.instagram_publish_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with busy as (
    select distinct owner_id
      from public.instagram_publish_jobs
     where status = 'running' and lease_until > now()
  ),
  ranked as (
    select j.id,
           row_number() over (partition by j.owner_id order by j.scheduled_at, j.created_at) as rn
      from public.instagram_publish_jobs j
     where (j.status = 'queued' and j.scheduled_at <= now())
        or (j.status = 'running' and j.lease_until <= now())
  ),
  picked as (
    select j.id
      from public.instagram_publish_jobs j
      join ranked r on r.id = j.id
     where r.rn = 1
       and j.owner_id not in (select owner_id from busy)
     order by j.scheduled_at, j.created_at
     for update of j skip locked
     limit p_limit
  )
  update public.instagram_publish_jobs t
     set status = 'running',
         lease_until = now() + make_interval(secs => p_lease_seconds),
         attempts = t.attempts + 1
    from picked
   where t.id = picked.id
  returning t.*;
end;
$$;

revoke all on function public.claim_instagram_publish_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_instagram_publish_jobs(integer, integer) to service_role;

-- ─── Meta 가 가져갈 JPEG ────────────────────────────────────────────────────
--   publish : {owner_id}/{batch}/{n}.jpg   JPEG 만, 8MB 까지(인스타 규격). 발행이 끝나면 지운다.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('publish', 'publish', false, 8388608, array['image/jpeg'])
    on conflict (id) do nothing;
  end if;
end;
$$;
