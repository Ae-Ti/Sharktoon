\set ON_ERROR_STOP on
-- 콘텐츠 안전 판정 기록(마이그레이션 0011): 본인·운영자만 읽고, 쓰기는 서버만.

create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', msg; end if;
  raise notice 'OK %', msg;
end $$;

insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999', 's1@a.b'),
  ('99999999-0000-0000-0000-000000000002', 's2@a.b'),
  ('99999999-0000-0000-0000-00000000000a', 'admin@a.b');
update profiles set is_admin = true where id = '99999999-0000-0000-0000-00000000000a';

insert into safety_events (owner_id, kind, source) values
  ('99999999-9999-9999-9999-999999999999', 'image_flagged', 'fal'),
  ('99999999-9999-9999-9999-999999999999', 'text_blocked', 'text_filter'),
  ('99999999-0000-0000-0000-000000000002', 'image_flagged', 'fal');

set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
set role authenticated;
select pg_temp.assert((select count(*) from safety_events) = 2, '본인 판정만 보인다');
do $$ begin
  insert into safety_events (owner_id, kind, source) values ('99999999-9999-9999-9999-999999999999', 'text_blocked', 'x');
  raise exception 'FAIL 사용자가 판정을 썼다';
exception when insufficient_privilege then raise notice 'OK 사용자 판정 쓰기 차단';
end $$;
do $$ begin
  delete from safety_events;
  raise exception 'FAIL 사용자가 판정을 지웠다';
exception when insufficient_privilege then raise notice 'OK 사용자 판정 삭제 차단';
end $$;
reset role;

set request.jwt.claim.sub = '99999999-0000-0000-0000-00000000000a';
set role authenticated;
select pg_temp.assert((select count(*) from safety_events) >= 3, '운영자는 전체를 본다');
reset role;
