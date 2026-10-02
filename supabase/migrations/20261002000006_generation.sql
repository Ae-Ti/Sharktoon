-- 생성 파이프라인 테이블: 콘티, 생성 잡, 컷(이미지·레이어), 게시물 패키지.
-- 0001 주석에서 "웅싯이 다음 번호로 추가한다"고 남겨 둔 자리다.
--
-- 쓰기 경로가 둘이다.
--   사용자(authenticated) — 콘티 편집, 레이어 편집, 게시물 패키지, 게시 표시
--   생성 워커(service_role) — 잡 상태, 컷 이미지, 회차 상태(generating·ready)
-- 워커가 쓰는 열은 사용자가 못 고치게 열 단위로 막는다. 특히 컷 이미지 경로를
-- 사용자가 바꿀 수 있으면 남의 파일 경로를 넣고 서명 URL 을 받아 갈 수 있다.

create type generation_job_status as enum (
  'queued', 'running', 'succeeded', 'partially_failed', 'failed'
);

-- 회차당 콘티 하나. 컷별 JSON 을 통째로 둔다(PRD 부록 B "Storyboard(컷별 JSON)").
-- 컷 순서·대사를 고칠 때마다 전체를 다시 쓰고, 생성은 그 시점의 사본을 잡에 싣는다.
create table public.storyboards (
  episode_id uuid primary key references public.episodes (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  data jsonb not null,
  -- ANTHROPIC_API_KEY 없이 만든 목 콘티인지. 운영 지표에서 걸러낸다.
  used_mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger storyboards_set_updated_at
before update on public.storyboards
for each row execute function public.set_updated_at();

-- 생성 잡. 큐 구현(오픈 이슈 11)과 무관하게 화면이 읽는 상태의 사본이다.
-- 컷별 진행은 cuts jsonb 에 GenerationJob.cuts 모양 그대로 둔다.
create table public.generation_jobs (
  id text primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  mode text not null check (mode in ('agent', 'single_cut')),
  status generation_job_status not null default 'queued',
  cuts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index generation_jobs_episode_idx on public.generation_jobs (episode_id, created_at desc);
-- 사용자별 동시 생성 3화 제한(PRD 비기능 요구사항)을 세는 데 쓴다.
create index generation_jobs_owner_status_idx on public.generation_jobs (owner_id, status);

create trigger generation_jobs_set_updated_at
before update on public.generation_jobs
for each row execute function public.set_updated_at();

-- 컷. 콘티의 컷 id 를 그대로 키로 쓴다 — 생성 결과는 콘티 컷에 연결된다(PRD 3.1.1).
create table public.cuts (
  episode_id uuid not null references public.episodes (id) on delete cascade,
  cut_id text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  index integer not null check (index between 1 and 10),
  -- Storage 'cuts' 버킷 안의 경로. 서명 URL 로만 내보낸다.
  image_path text,
  -- 모든 생성물에 AI 생성 메타데이터를 기록한다(콘텐츠 안전 정책).
  generation_meta jsonb not null default '{}'::jsonb,
  -- 편집기 레이어 트리(CutLayerTree). 없으면 콘티와 이미지에서 처음 한 번 만든다.
  layer_tree jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (episode_id, cut_id)
);

create trigger cuts_set_updated_at
before update on public.cuts
for each row execute function public.set_updated_at();

-- 4.1 게시물 패키지. 캡션 3안, 해시태그(시리즈 고정 / 화별 동적), 첫 댓글.
create table public.post_packages (
  episode_id uuid primary key references public.episodes (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  captions jsonb not null,
  hashtags jsonb not null,
  first_comment text not null,
  used_mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger post_packages_set_updated_at
before update on public.post_packages
for each row execute function public.set_updated_at();

alter table public.storyboards enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.cuts enable row level security;
alter table public.post_packages enable row level security;

create policy "본인 콘티" on public.storyboards
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 잡은 읽기만. 상태를 바꾸는 건 워커다.
create policy "본인 생성 잡 조회" on public.generation_jobs
  for select using (auth.uid() = owner_id);

create policy "본인 컷 조회" on public.cuts
  for select using (auth.uid() = owner_id);

create policy "본인 컷 레이어 수정" on public.cuts
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "본인 게시물 패키지" on public.post_packages
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 열 단위 권한. 사용자는 레이어 트리만 고친다. 이미지 경로·메타데이터는 워커 몫이다.
revoke insert, update, delete on public.cuts from anon, authenticated;
grant update (layer_tree) on public.cuts to authenticated;

revoke insert, update, delete on public.generation_jobs from anon, authenticated;

-- 스토리지 버킷. 둘 다 비공개이고 서버가 서명 URL 을 발급한다.
--   cuts   : 생성된 컷 이미지  {owner_id}/{episode_id}/{cut_id}.{ext}
--   assets : 에셋 레퍼런스·캐릭터 시트·셀카 원본  {owner_id}/{asset_id}/{name}
-- 업로드도 서버(서비스 롤)만 한다. 그래서 storage.objects 에 사용자 정책을 두지 않는다.
-- CI 의 맨 Postgres 에는 storage 스키마가 없으므로 있을 때만 만든다.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('cuts', 'cuts', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
      ('assets', 'assets', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
    on conflict (id) do nothing;
  end if;
end;
$$;
