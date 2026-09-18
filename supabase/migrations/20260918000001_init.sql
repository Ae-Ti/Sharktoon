-- 샥툰 기본 스키마: 확장, 열거형, 공용 트리거, 프로필
-- 오너: 태일(B). 생성 파이프라인 테이블(storyboards, cuts, layers, generation_jobs)은 웅싯(A)이 별도 마이그레이션으로 추가한다.

create extension if not exists pgcrypto;

create type asset_kind as enum ('character', 'location', 'prop', 'style');

create type episode_status as enum ('draft', 'storyboard', 'generating', 'ready', 'published');

create type plan_tier as enum ('free', 'basic', 'pro');

-- 스토리·캡션 생성은 크레딧을 쓰지 않으므로 여기 없다.
create type credit_spend_reason as enum ('cut_image', 'partial_regenerate', 'animation_episode');

create type credit_earn_reason as enum (
  'signup_bonus',
  'attendance_daily',
  'attendance_streak',
  'subscription_grant',
  'credit_pack',
  'generation_refund',
  'monthly_rollover'
);

create type credit_hold_status as enum ('held', 'committed', 'refunded');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  plan plan_tier not null default 'free',
  -- 셀카 원본은 캐릭터 시트를 만든 뒤 삭제하는 것이 기본값이다. 사용자가 켜야 30일 보관한다.
  keep_selfie_original boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "본인 프로필 조회" on public.profiles
  for select using (auth.uid() = id);

create policy "본인 프로필 수정" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
