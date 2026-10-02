\set ON_ERROR_STOP on
-- 크레딧 묶음(마이그레이션 0008): 차감 순서, 환불 복원, 만료, 구독 이월, 환불 견적, 출석 상한.

insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'lot@a.b');
\set U '\'55555555-5555-5555-5555-555555555555\''

create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', msg; end if;
  raise notice 'OK %', msg;
end $$;

create or replace function pg_temp.ledger_ok(u uuid) returns boolean language sql as $$
  select (select balance from credit_accounts where user_id = u)
       = (select coalesce(sum(remaining), 0) from credit_lots where user_id = u)
     and (select balance from credit_accounts where user_id = u)
       = (select coalesce(sum(amount), 0) from credit_transactions where user_id = u)
$$;

select pg_temp.assert((select balance from credit_accounts where user_id = :U) = 8, '가입 8크레딧, 무상 묶음');
select pg_temp.assert(pg_temp.ledger_ok(:U), '잔량 = 묶음 합 = 원장 합');

set role service_role;
-- 구매 20크레딧(1크레딧 245원), 구독 80크레딧(1크레딧 186.25원)
insert into payments (id, user_id, provider, product, amount_krw, paid_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', :U, 'manual', 'pack20', 4900, now() - interval '10 days');
select credit_grant(:U, 'purchase', 20, 245, 'credit_pack', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into payments (id, user_id, provider, product, amount_krw)
values ('aaaaaaaa-0000-0000-0000-000000000002', :U, 'manual', 'basic', 14900);
select credit_start_subscription_period(:U, 80, 186.25, 'aaaaaaaa-0000-0000-0000-000000000002', now() + interval '30 days');
select pg_temp.assert((select balance from credit_accounts where user_id = :U) = 108, '8 + 20 + 80 = 108');

-- 10 차감: 무상 8 먼저, 그 다음 구독 2. 구매는 안 건드린다.
select credit_hold(:U, 10, 'cut_image', 'job-a') as h1 \gset
select pg_temp.assert((select remaining from credit_lots where user_id = :U and kind = 'free') = 0, '무상부터 다 쓴다');
select pg_temp.assert((select remaining from credit_lots where user_id = :U and kind = 'subscription') = 78, '그 다음 구독');
select pg_temp.assert((select remaining from credit_lots where user_id = :U and kind = 'purchase') = 20, '구매는 마지막');

-- 환불하면 가져간 묶음으로 돌아간다.
select credit_refund(:'h1', '실패');
select pg_temp.assert((select remaining from credit_lots where user_id = :U and kind = 'free') = 8, '환불은 무상 묶음으로 복원');
select pg_temp.assert((select remaining from credit_lots where user_id = :U and kind = 'subscription') = 80, '구독 묶음도 복원');
select pg_temp.assert(pg_temp.ledger_ok(:U), '환불 뒤 원장 정합');

-- 무상 묶음 만료: 다음 hold 때 먼저 만료 처리하고 구독에서 차감한다.
reset role;
update credit_lots set expires_at = now() - interval '1 second' where user_id = :U and kind = 'free';
set role service_role;
select credit_hold(:U, 1, 'cut_image', 'job-b') as h2 \gset
select credit_commit(:'h2');
select pg_temp.assert((select balance from credit_accounts where user_id = :U) = 99, '만료 8 빠지고 1 차감 → 99');
select pg_temp.assert(exists (select 1 from credit_transactions where user_id = :U and spend_reason = 'expiry' and amount = -8), '만료 거래 기록');
select pg_temp.assert(pg_temp.ledger_ok(:U), '만료 뒤 원장 정합');

-- 다음 구독 기간: 남은 구독 79 → 39.5 이월(한 번만), 새로 80.
select credit_start_subscription_period(:U, 80, 186.25, null, now() + interval '60 days');
select pg_temp.assert((select sum(remaining) from credit_lots where user_id = :U and kind = 'subscription') = 119.5, '79의 절반 39.5 이월 + 80');
select pg_temp.assert((select count(*) from credit_lots where user_id = :U and is_rollover and remaining > 0) = 1, '이월 묶음 표시');
-- 그 다음 기간: 이월분은 다시 이월되지 않는다.
select credit_start_subscription_period(:U, 80, 186.25, null, now() + interval '90 days');
select pg_temp.assert((select sum(remaining) from credit_lots where user_id = :U and kind = 'subscription') = 120, '이월분 39.5 는 소멸, 80의 절반 40 + 새 80');
select pg_temp.assert(pg_temp.ledger_ok(:U), '이월 뒤 원장 정합');
reset role;

-- 환불 견적: 구독 120 × 186.25 + 구매 20 × 245 = 27250. 10% 공제(결제 7일 넘음) → 24525.
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
set role authenticated;
select pg_temp.assert((select gross_krw from credit_refund_quote()) = 27250, '환불 견적 총액');
select pg_temp.assert((select net_krw from credit_refund_quote()) = 24525, '10% 공제');
select request_credit_refund('그만 쓸래요') as rid \gset
do $$ begin
  perform request_credit_refund('또');
  raise exception 'FAIL 중복 신청';
exception when sqlstate 'SK007' then raise notice 'OK 처리 중 신청은 하나만';
end $$;
do $$ begin
  perform admin_process_refund((select id from refund_requests limit 1), true);
  raise exception 'FAIL 일반 사용자가 환불 승인';
exception when sqlstate 'SK004' then raise notice 'OK 환불 승인은 운영자만';
end $$;
do $$ begin
  perform admin_grant_purchase('55555555-5555-5555-5555-555555555555', 100, 0);
  raise exception 'FAIL 일반 사용자가 지급';
exception when sqlstate 'SK004' then raise notice 'OK 수동 지급은 운영자만';
end $$;
do $$ begin
  perform credit_grant('55555555-5555-5555-5555-555555555555', 'purchase', 100, 0, 'credit_pack');
  raise exception 'FAIL 사용자가 직접 지급';
exception when insufficient_privilege then raise notice 'OK 사용자 직접 지급 차단';
end $$;
reset role;

-- 운영자 승인: 유료 묶음이 비고 지급 거래가 남는다.
update profiles set is_admin = true where id = :U;
set role authenticated;
select admin_process_refund(:'rid', true, '결제 취소 완료');
reset role;
select pg_temp.assert((select balance from credit_accounts where user_id = :U) = 0, '승인 뒤 유료 잔량 0');
select pg_temp.assert((select status from refund_requests where id = :'rid') = 'approved', '신청 승인됨');
select pg_temp.assert(pg_temp.ledger_ok(:U), '환불 지급 뒤 원장 정합');

-- 운영자 수동 지급: 결제 기록과 구매 묶음이 같이 생긴다.
set role authenticated;
select admin_grant_purchase('55555555-5555-5555-5555-555555555555', 10, 2450, '계좌이체');
reset role;
select pg_temp.assert((select count(*) from payments where user_id = :U and provider = 'manual' and amount_krw = 2450) = 1, '수동 지급 결제 기록');
select pg_temp.assert((select unit_price from credit_lots where user_id = :U and kind = 'purchase' and amount = 10) = 245, '수동 지급 단가 245원');
select pg_temp.assert(pg_temp.ledger_ok(:U), '수동 지급 뒤 원장 정합');
set role service_role;
select credit_hold(:U, 10, 'cut_image', 'job-c') as h3 \gset
select credit_commit(:'h3');
reset role;

-- 7일 안이고 안 쓴 결제는 공제하지 않는다.
set role service_role;
insert into payments (id, user_id, provider, product, amount_krw)
values ('aaaaaaaa-0000-0000-0000-000000000003', :U, 'manual', 'pack20', 4900);
select credit_grant(:U, 'purchase', 20, 245, 'credit_pack', 'aaaaaaaa-0000-0000-0000-000000000003');
reset role;
set role authenticated;
select pg_temp.assert((select fee_krw from credit_refund_quote()) = 0 and (select net_krw from credit_refund_quote()) = 4900, '7일 내 미사용은 전액');
reset role;

-- 출석 한 달 상한 3: 이번 달 출석 지급을 2.5 로 만들어 두면 오늘은 0.5 만 들어온다.
set role service_role;
select _credit_add_lot(:U, 'free', 2.5, 0, 'attendance_daily', now() + interval '90 days');
reset role;
delete from attendance where user_id = :U;
set role authenticated;
select pg_temp.assert((select granted from attendance_check_in()) = 0.5, '상한까지 0.5');
reset role;
delete from attendance where user_id = :U;
set role authenticated;
select pg_temp.assert((select granted from attendance_check_in()) = 0, '상한에 닿으면 0, 출석은 기록');
reset role;
select pg_temp.assert(pg_temp.ledger_ok(:U), '출석 뒤 원장 정합');

-- 탈퇴 요청과 철회
set role authenticated;
select request_account_deletion() is not null as requested \gset
select pg_temp.assert((select deletion_requested_at is not null from profiles where id = :U), '탈퇴 요청 기록');
select cancel_account_deletion();
select pg_temp.assert((select deletion_requested_at is null from profiles where id = :U), '탈퇴 철회');
reset role;
