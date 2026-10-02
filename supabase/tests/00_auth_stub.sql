-- Supabase 환경을 로컬 Postgres 에서 흉내낸다. 운영에는 적용하지 않는다.
do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
-- Supabase 의 service_role 은 RLS 를 건너뛴다. 생성 워커·정산이 이 성질에 기댄다.
alter role service_role bypassrls;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated;

-- Supabase 는 public 스키마의 새 테이블·함수에 anon·authenticated·service_role 권한을 기본으로 준다.
-- 같은 기본값을 깔아 둬야 마이그레이션의 revoke 가 실제로 막는지 테스트할 수 있다.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
