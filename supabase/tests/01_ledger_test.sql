\set ON_ERROR_STOP on
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;

-- 1. 가입 트리거
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'a@b.c', '{"name":"태일"}'::jsonb);

select '1. 가입 직후' as step,
       (select balance from credit_accounts) as balance,
       (select count(*) from profiles) as profiles,
       (select amount from credit_transactions) as tx;

grant usage on schema public to service_role;
grant select on all tables in schema public to service_role;

-- 정산은 생성 워커(서비스 롤)만 한다(마이그레이션 0005).
set role service_role;

-- 2. hold: 6컷 생성
select credit_hold('11111111-1111-1111-1111-111111111111', 6, 'cut_image', 'job-1') as hold_id \gset
select '2. hold 6' as step, balance, held from credit_accounts;

-- 3. commit
select credit_commit(:'hold_id');
select '3. commit' as step, balance, held from credit_accounts;

-- 4. hold 1 → refund (생성 실패)
select credit_hold('11111111-1111-1111-1111-111111111111', 1, 'cut_image', 'job-2') as h2 \gset
select credit_refund(:'h2', '3번 컷 실패') as refunded;
select '4. refund' as step, balance, held from credit_accounts;

-- 5. 원장 합계 == 잔량
select '5. 원장 정합' as step,
       (select sum(amount) from credit_transactions) as tx_sum,
       (select balance from credit_accounts) as balance,
       (select sum(amount) from credit_transactions) = (select balance from credit_accounts) as matches;

-- 6. 잔량보다 큰 요청은 막힌다
do $$
begin
  perform credit_hold('11111111-1111-1111-1111-111111111111', 99, 'cut_image', 'job-3');
  raise exception '막히지 않았다';
exception when sqlstate 'SK001' then
  raise notice '6. 크레딧 부족 차단 OK';
end;
$$;

-- 7. 이미 정산된 hold 재환불 차단
do $$
begin
  perform credit_refund('00000000-0000-0000-0000-000000000000'::uuid, 'x');
  raise exception '막히지 않았다';
exception when sqlstate 'SK002' then
  raise notice '7. 중복 정산 차단 OK';
end;
$$;

reset role;

-- 7-1. 사용자는 정산 함수를 직접 부를 수 없다. 열려 있으면 생성 중인 hold 를 브라우저에서
--      환불받을 수 있다(2026-10-02 실 테스트에서 확인한 구멍).
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
do $$
begin
  perform credit_hold('11111111-1111-1111-1111-111111111111', 1, 'cut_image', 'job-x');
  raise exception '사용자가 hold 를 직접 걸었다';
exception when insufficient_privilege then
  raise notice '7-1. 사용자 hold 차단 OK';
end;
$$;
do $$
begin
  perform credit_refund('00000000-0000-0000-0000-000000000000'::uuid, 'x');
  raise exception '사용자가 refund 를 직접 불렀다';
exception when insufficient_privilege then
  raise notice '7-2. 사용자 refund 차단 OK';
end;
$$;
do $$
begin
  perform credit_commit('00000000-0000-0000-0000-000000000000'::uuid);
  raise exception '사용자가 commit 을 직접 불렀다';
exception when insufficient_privilege then
  raise notice '7-3. 사용자 commit 차단 OK';
end;
$$;
reset role;

-- 8. 출석 7일 연속 보너스
insert into attendance (user_id, attended_on, streak)
select '11111111-1111-1111-1111-111111111111',
       ((now() at time zone 'Asia/Seoul')::date - g),
       7 - g
from generate_series(1, 6) g;
set role authenticated;
select '8. 출석' as step, * from attendance_check_in();

-- 9. 다른 사용자 데이터는 안 보인다 (RLS)
reset role;
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'x@y.z');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select '9. RLS' as step, count(*) as 보이는_계정수 from credit_accounts;
