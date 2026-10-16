\set ON_ERROR_STOP on
-- 인스타 연동(마이그레이션 0009): 토큰 열 비공개, 발행 큐 꺼내기 규칙, 규격 제약, 권한.

create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', msg; end if;
  raise notice 'OK %', msg;
end $$;

-- 01 테스트가 모든 테이블에 select 를 열어 둔다. 마이그레이션 0009 가 정한 열 권한으로 되돌린다.
revoke all on instagram_accounts from anon, authenticated;
grant select (owner_id, ig_user_id, username, account_type, token_expires_at, connected_at)
  on instagram_accounts to authenticated;

insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'ig@a.b'),
  ('77777777-0000-0000-0000-000000000099', 'ig2@a.b');
insert into series (id, owner_id, title) values
  ('77777777-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'ig'),
  ('77777777-0000-0000-0000-000000000011', '77777777-0000-0000-0000-000000000099', 'ig2');
insert into episodes (id, series_id, owner_id, number) values
  ('77777777-0000-0000-0000-000000000002', '77777777-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 1),
  ('77777777-0000-0000-0000-000000000012', '77777777-0000-0000-0000-000000000011', '77777777-0000-0000-0000-000000000099', 1);

insert into instagram_accounts (owner_id, ig_user_id, username, access_token_enc, token_expires_at)
values ('77777777-7777-7777-7777-777777777777', '17840000000000001', 'tester', 'v1.enc', now() + interval '60 days');

-- 규격 제약: 11장, 2,201자 캡션은 들어가지 않는다.
do $$ begin
  insert into instagram_publish_jobs (owner_id, episode_id, image_paths)
  values ('77777777-7777-7777-7777-777777777777', '77777777-0000-0000-0000-000000000002',
          (select array_agg('p' || g) from generate_series(1, 11) g));
  raise exception 'FAIL 11장 캐러셀이 들어갔다';
exception when check_violation then raise notice 'OK 캐러셀 10장 제한';
end $$;
do $$ begin
  insert into instagram_publish_jobs (owner_id, episode_id, image_paths, caption)
  values ('77777777-7777-7777-7777-777777777777', '77777777-0000-0000-0000-000000000002', array['p1'], repeat('가', 2201));
  raise exception 'FAIL 2,201자 캡션이 들어갔다';
exception when check_violation then raise notice 'OK 캡션 2,200자 제한';
end $$;

insert into instagram_publish_jobs (id, owner_id, episode_id, image_paths, scheduled_at) values
  ('77777777-1111-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', '77777777-0000-0000-0000-000000000002', array['p1','p2'], now() - interval '1 minute'),
  ('77777777-1111-0000-0000-000000000002', '77777777-7777-7777-7777-777777777777', '77777777-0000-0000-0000-000000000002', array['p1','p2'], now() - interval '30 seconds'),
  ('77777777-1111-0000-0000-000000000003', '77777777-7777-7777-7777-777777777777', '77777777-0000-0000-0000-000000000002', array['p1'], now() + interval '1 day'),
  ('77777777-1111-0000-0000-000000000004', '77777777-0000-0000-0000-000000000099', '77777777-0000-0000-0000-000000000012', array['p1'], now() - interval '10 seconds');

set role service_role;
create temp table c1 as select * from claim_instagram_publish_jobs(10, 60);
select pg_temp.assert((select count(*) from c1) = 2, '계정마다 하나씩 꺼낸다');
select pg_temp.assert(exists (select 1 from c1 where id = '77777777-1111-0000-0000-000000000001'), '먼저 예약된 것부터');
select pg_temp.assert(not exists (select 1 from c1 where id = '77777777-1111-0000-0000-000000000003'), '예약 시각 전에는 안 꺼낸다');
select pg_temp.assert((select count(*) from claim_instagram_publish_jobs(10, 60)) = 0, '같은 계정이 도는 중이면 더 안 꺼낸다');

update instagram_publish_jobs set status = 'published', lease_until = null where id = '77777777-1111-0000-0000-000000000001';
select pg_temp.assert(
  (select id from claim_instagram_publish_jobs(10, 60)) = '77777777-1111-0000-0000-000000000002',
  '끝나면 그 계정의 다음 것을 꺼낸다');

update instagram_publish_jobs set lease_until = now() - interval '1 second' where id = '77777777-1111-0000-0000-000000000002';
select pg_temp.assert(
  (select attempts from claim_instagram_publish_jobs(10, 60) where id = '77777777-1111-0000-0000-000000000002') = 2,
  '임대가 지나면 다시 꺼내고 시도 수를 올린다');
reset role;

-- 사용자는 자기 계정의 토큰 아닌 열과 자기 발행 작업만 읽는다.
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
set role authenticated;
select pg_temp.assert((select username from instagram_accounts) = 'tester', '본인 계정 조회');
do $$ begin
  perform access_token_enc from instagram_accounts;
  raise exception 'FAIL 사용자가 토큰 열을 읽었다';
exception when insufficient_privilege then raise notice 'OK 토큰 열 차단';
end $$;
select pg_temp.assert((select count(*) from instagram_publish_jobs) = 3, '본인 발행 작업 조회');
do $$ begin
  update instagram_publish_jobs set status = 'published';
  raise exception 'FAIL 사용자가 발행 상태를 바꿨다';
exception when insufficient_privilege then raise notice 'OK 사용자 발행 수정 차단';
end $$;
do $$ begin
  perform claim_instagram_publish_jobs(1, 60);
  raise exception 'FAIL 사용자가 발행 큐에서 꺼냈다';
exception when insufficient_privilege then raise notice 'OK 사용자 발행 큐 꺼내기 차단';
end $$;
reset role;

set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000099';
set role authenticated;
select pg_temp.assert((select count(*) from instagram_accounts) = 0, '남의 인스타 계정은 안 보인다');
select pg_temp.assert((select count(*) from instagram_publish_jobs) = 1, '남의 발행 작업은 안 보인다');
reset role;
