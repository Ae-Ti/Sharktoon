\set ON_ERROR_STOP on
-- 생성 큐(마이그레이션 0007): 두 번 안 꺼내기, 잡당 동시 실행 상한, 임대 만료 회수, 권한.

create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', msg; end if;
  raise notice 'OK %', msg;
end $$;

insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'q@a.b');
insert into series (id, owner_id, title) values ('66666666-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'q');
insert into episodes (id, series_id, owner_id, number) values
  ('66666666-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 1);
insert into generation_jobs (id, owner_id, episode_id, mode) values
  ('qjob-1', '66666666-6666-6666-6666-666666666666', '66666666-0000-0000-0000-000000000002', 'agent'),
  ('qjob-2', '66666666-6666-6666-6666-666666666666', '66666666-0000-0000-0000-000000000002', 'agent');
insert into generation_tasks (job_id, owner_id, episode_id, cut_id, index, prompt)
select 'qjob-1', '66666666-6666-6666-6666-666666666666', '66666666-0000-0000-0000-000000000002', 'c' || g, g, '장면'
  from generate_series(1, 6) g;
insert into generation_tasks (job_id, owner_id, episode_id, cut_id, index, prompt)
values ('qjob-2', '66666666-6666-6666-6666-666666666666', '66666666-0000-0000-0000-000000000002', 'd1', 1, '장면');

set role service_role;
create temp table first_claim as select * from claim_generation_tasks(10, 60, 2);
select pg_temp.assert((select count(*) from first_claim where job_id = 'qjob-1') = 2, '잡당 동시 2개까지');
select pg_temp.assert((select count(*) from first_claim where job_id = 'qjob-2') = 1, '다른 잡도 같이 꺼낸다');
select pg_temp.assert((select count(*) from claim_generation_tasks(10, 60, 2)) = 0, '돌고 있는 잡에서 더 안 꺼낸다');

-- 하나 끝나면 그 잡에서 하나 더 꺼낼 수 있다.
update generation_tasks set status = 'done', lease_until = null
 where id = (select min(id) from first_claim where job_id = 'qjob-1');
select pg_temp.assert((select count(*) from claim_generation_tasks(10, 60, 2)) = 1, '끝난 만큼 다시 꺼낸다');

-- 작업자가 죽어 임대가 지나면 다른 작업자가 가져간다.
update generation_tasks set lease_until = now() - interval '1 second' where status = 'running' and job_id = 'qjob-2';
select pg_temp.assert((select count(*) from claim_generation_tasks(10, 60, 2) where job_id = 'qjob-2') = 1, '임대가 지난 작업 회수');
reset role;

-- 사용자는 자기 작업을 읽기만 한다.
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
set role authenticated;
select pg_temp.assert((select count(*) from generation_tasks) = 7, '본인 작업 조회');
do $$ begin
  perform claim_generation_tasks(1, 60, 2);
  raise exception 'FAIL 사용자가 큐에서 꺼냈다';
exception when insufficient_privilege then raise notice 'OK 사용자 큐 꺼내기 차단';
end $$;
do $$ begin
  update generation_tasks set status = 'done';
  raise exception 'FAIL 사용자가 작업 상태를 바꿨다';
exception when insufficient_privilege then raise notice 'OK 사용자 작업 수정 차단';
end $$;
reset role;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select pg_temp.assert((select count(*) from generation_tasks) = 0, '남의 작업은 안 보인다');
reset role;
