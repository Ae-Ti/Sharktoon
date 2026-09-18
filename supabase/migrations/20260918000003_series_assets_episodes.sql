-- 시리즈, 에셋, 회차. 연재를 지탱하는 자산 구조.
-- 에셋을 바꾸면 영향받는 회차를 보여줘야 하므로 참조 관계를 테이블로 남긴다.

create table public.series (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  cover_path text,
  -- 공개 피드 노출 여부. 오픈 베타 범위지만 컬럼은 지금 만들어 둔다.
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index series_owner_idx on public.series (owner_id, updated_at desc);

create trigger series_set_updated_at
before update on public.series
for each row execute function public.set_updated_at();

-- 시리즈 생성 규칙. 모든 회차의 생성 요청에 이 값이 주입된다.
create table public.series_rules (
  series_id uuid primary key references public.series (id) on delete cascade,
  style_preset text not null default 'simple_line',
  default_cut_count integer not null default 6 check (default_cut_count between 4 and 10),
  aspect_ratio text not null default '4:5' check (aspect_ratio in ('1:1', '4:5')),
  -- 말투 규칙. 캡션 생성도 이걸 따른다.
  tone text,
  narration_style jsonb not null default '{}'::jsonb,
  -- 시리즈 고정 해시태그. 화별 동적 해시태그와 구분한다.
  fixed_hashtags text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger series_rules_set_updated_at
before update on public.series_rules
for each row execute function public.set_updated_at();

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind asset_kind not null,
  name text not null,
  description text,
  tags text[] not null default '{}' check (array_length(tags, 1) is null or array_length(tags, 1) <= 5),
  -- 캐릭터 시트는 정면·측면·표정 4종·전신. Storage 경로만 두고 서명 URL 로만 노출한다.
  reference_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_owner_kind_idx on public.assets (owner_id, kind);

create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

-- 시리즈에 고정으로 붙는 에셋 세트. 새 화는 여기 있는 것을 자동으로 물려받는다.
create table public.series_assets (
  series_id uuid not null references public.series (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  primary key (series_id, asset_id)
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  number integer not null check (number > 0),
  title text,
  -- 사용자가 입력한 사연 원문. 콘티 생성의 입력이다.
  story text,
  status episode_status not null default 'draft',
  cut_count integer not null default 6 check (cut_count between 4 and 10),
  -- 다음 화 제안과 성과 메모의 근거로 쓴다.
  note text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, number)
);

create index episodes_series_idx on public.episodes (series_id, number);

create trigger episodes_set_updated_at
before update on public.episodes
for each row execute function public.set_updated_at();

-- 회차가 실제로 참조한 에셋. 에셋 변경 시 영향받는 회차를 이 표로 찾는다.
create table public.asset_references (
  episode_id uuid not null references public.episodes (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  primary key (episode_id, asset_id)
);

create index asset_references_asset_idx on public.asset_references (asset_id);

alter table public.series enable row level security;
alter table public.series_rules enable row level security;
alter table public.assets enable row level security;
alter table public.series_assets enable row level security;
alter table public.episodes enable row level security;
alter table public.asset_references enable row level security;

create policy "본인 시리즈" on public.series
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 공개 시리즈는 누구나 읽는다. 다른 사용자의 에셋과 저작물은 복제할 수 없으므로 읽기만 연다.
create policy "공개 시리즈 조회" on public.series
  for select using (is_public);

create policy "본인 시리즈 규칙" on public.series_rules
  for all using (
    exists (select 1 from public.series s where s.id = series_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.series s where s.id = series_id and s.owner_id = auth.uid())
  );

create policy "본인 에셋" on public.assets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "본인 시리즈의 에셋 연결" on public.series_assets
  for all using (
    exists (select 1 from public.series s where s.id = series_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.series s where s.id = series_id and s.owner_id = auth.uid())
  );

create policy "본인 회차" on public.episodes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "공개 시리즈의 게시된 회차 조회" on public.episodes
  for select using (
    status = 'published'
    and exists (select 1 from public.series s where s.id = series_id and s.is_public)
  );

create policy "본인 회차의 에셋 참조" on public.asset_references
  for all using (
    exists (select 1 from public.episodes e where e.id = episode_id and e.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.episodes e where e.id = episode_id and e.owner_id = auth.uid())
  );
