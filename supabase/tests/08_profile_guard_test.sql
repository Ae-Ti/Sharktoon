\set ON_ERROR_STOP on
-- 프로필 열 권한(마이그레이션 0010): 사용자는 이름·사진만 고치고, 운영자 플래그·요금제는 못 바꾼다.

create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', msg; end if;
  raise notice 'OK %', msg;
end $$;

insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'guard@a.b');

set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
set role authenticated;
update profiles set display_name = '새 이름' where id = '88888888-8888-8888-8888-888888888888';
select pg_temp.assert((select display_name from profiles) = '새 이름', '본인 이름은 고친다');
do $$ begin
  update profiles set is_admin = true where id = '88888888-8888-8888-8888-888888888888';
  raise exception 'FAIL 사용자가 스스로 운영자가 됐다';
exception when insufficient_privilege then raise notice 'OK 운영자 플래그 수정 차단';
end $$;
do $$ begin
  update profiles set plan = 'pro' where id = '88888888-8888-8888-8888-888888888888';
  raise exception 'FAIL 사용자가 요금제를 바꿨다';
exception when insufficient_privilege then raise notice 'OK 요금제 수정 차단';
end $$;
reset role;
select pg_temp.assert(
  (select not is_admin and plan = 'free' from profiles where id = '88888888-8888-8888-8888-888888888888'),
  '운영자 플래그와 요금제는 그대로');
