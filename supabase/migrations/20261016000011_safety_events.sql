-- 콘텐츠 안전 판정 기록 (개인정보 처리방침: "생성 요청·콘텐츠 필터 기록 1년").
--
--   text_blocked  : 사연·장면·지시문이 우리 텍스트 필터에 막혔다. 생성 전이라 차감하지 않는다.
--   image_flagged : 이미지 모델의 안전 검사(fal has_nsfw_concepts 등)에 결과가 걸렸다.
--                   오탐이 섞여 있어 크레딧은 돌려준다(약관 제8조 제2항). 대신 24시간에 여러 번 걸리면
--                   생성을 잠시 막고 운영자가 기록을 본다(약관의 이용 제한·이의 제기 절차).
--
-- 프롬프트 원문은 남기지 않는다(처리방침에 적은 항목은 판정 결과까지다). 어느 회차·컷인지만 남긴다.
-- 1년이 지난 행은 하루 한 번 크론(/api/cron/daily)이 지운다.

create type safety_event_kind as enum ('text_blocked', 'image_flagged');

create table public.safety_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind safety_event_kind not null,
  -- 판정 출처: text_filter | fal | openai | …
  source text not null,
  category text,
  episode_id uuid references public.episodes (id) on delete set null,
  cut_id text,
  job_id text,
  created_at timestamptz not null default now()
);

create index safety_events_owner_idx on public.safety_events (owner_id, kind, created_at desc);
create index safety_events_recent_idx on public.safety_events (created_at desc);

alter table public.safety_events enable row level security;

-- 본인 기록(이의 제기용)과 운영자 검토. 쓰기는 서버(서비스 롤)만.
create policy "본인 또는 운영자 안전 기록 조회" on public.safety_events
  for select using (auth.uid() = owner_id or public.is_admin());

revoke insert, update, delete on public.safety_events from anon, authenticated;
