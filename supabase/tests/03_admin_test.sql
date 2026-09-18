\set ON_ERROR_STOP on
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on schema auth to authenticated;
grant select on auth.users to authenticated;

-- 일반 사용자는 집계를 볼 수 없다
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
do $$
begin
  perform * from admin_funnel();
  raise exception '막히지 않았다';
exception when sqlstate 'SK004' then
  raise notice 'A. 비운영자 차단 OK';
end $$;

-- 운영자로 올린 뒤에는 보인다
reset role;
update profiles set is_admin = true where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select 'B. 깔때기' as step, * from admin_funnel();
select 'C. 생성 지표' as step, * from admin_generation_stats();
select 'D. 최근 환불' as step, count(*) as 건수 from admin_recent_refunds(20);
