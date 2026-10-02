# Supabase

## 마이그레이션 적용

Supabase 프로젝트가 생기면 대시보드 SQL Editor 에 `migrations/` 의 파일을 번호순으로 붙여넣거나,
CLI 를 쓰면 `supabase link` 후 `supabase db push` 한다.

| 파일 | 내용 |
|---|---|
| `20260918000001_init.sql` | 확장, 열거형, `set_updated_at`, `profiles` |
| `20260918000002_credits.sql` | 크레딧 원장·hold 함수·출석, 가입 트리거 |
| `20260918000003_series_assets_episodes.sql` | 시리즈·생성 규칙·에셋·회차·참조 |
| `20260918000004_admin.sql` | 운영자 플래그와 집계 함수(깔때기·생성 지표·환불 내역) |
| `20261002000005_credit_server_only.sql` | 크레딧 정산 함수를 서비스 롤 전용으로. 누구의 크레딧인지 인자로 받는다 |
| `20261002000006_generation.sql` | 콘티·생성 잡·컷(이미지·레이어)·게시물 패키지, Storage 버킷 `cuts`·`assets` |
| `20261003000007_generation_queue.sql` | 생성 큐 `generation_tasks` 와 `claim_generation_tasks()` |
| `20261003000008_credit_lots.sql` | 크레딧 묶음(무상·구독·구매), 차감 순서, 만료·이월, 환불 견적·신청, 탈퇴 요청, 정책 테이블 |

로컬에서 스키마를 고쳤으면 `npm run db:reset` 으로 다시 적용하고 `npm run db:types` 로
`src/lib/supabase/database.generated.ts` 를 다시 뽑는다. 손으로 고치지 않는다.

## 크레딧 원장이 이렇게 생긴 이유

생성은 실패한다. 실패율 목표가 3% 이하지 0% 가 아니다. 단순 차감이면 "차감했는데 워커가 죽은" 구간에서
원장이 틀어지고, 그게 곧 환불 분쟁이다. 그래서 3단으로 나눴다.

| 함수 | 하는 일 |
|---|---|
| `credit_hold(user_id, amount, reason, job_id)` | 잔량에서 빼고 `held` 로 옮기며 **소모 거래를 이때 기록**한다. hold id 를 돌려준다 |
| `credit_commit(hold_id)` | `held` 만 줄인다. 거래는 이미 있다 |
| `credit_refund(hold_id, reason)` | 잔량으로 되돌리고 환불 거래를 남긴다 |

덕분에 `sum(credit_transactions.amount)` 이 언제나 `credit_accounts.balance` 와 같다. 테스트 5번이 이걸 검증한다.

원장 테이블은 RLS 로 **읽기만** 열려 있다. 값이 바뀌는 길은 위 `security definer` 함수뿐이다.

### 정산은 서버만 한다 (0005)

처음(0002)에는 세 함수를 `authenticated` 에 열어 두었다. 그러면 사용자가 브라우저에서
anon key 와 자기 토큰으로 **생성 중인 hold 를 직접 refund** 할 수 있다 — 이미지는 받고
크레딧은 돌려받는다(2026-10-02 실 테스트에서 재현). 그래서 세 함수를 `service_role` 전용으로
바꾸고, 누구의 크레딧인지는 세션이 아니라 `user_id` 인자로 받는다. 생성 워커가 잡의 소유자로 넣는다.

- 앱은 `SUPABASE_SERVICE_ROLE_KEY` 가 있어야 생성이 돈다(`src/lib/supabase/service.ts`).
- Supabase 는 public 스키마의 새 함수에 `anon`·`authenticated` 실행 권한을 **기본으로** 준다.
  `revoke ... from public` 만으로는 안 막힌다. 역할을 하나씩 적어야 한다.
- 출석(`attendance_check_in`)은 자기 크레딧을 늘리는 쪽이고 하루 한 번으로 막혀 있어 사용자에게 열어 둔다.

## 생성 테이블 (0006)

| 테이블 | 쓰는 쪽 | 사용자 권한 |
|---|---|---|
| `storyboards` | 사용자 | 본인 행 읽기·쓰기 |
| `generation_jobs` | 생성 워커(서비스 롤) | 본인 행 **읽기만** |
| `cuts` | 워커가 이미지·메타데이터, 사용자가 레이어 | 본인 행 읽기, **`layer_tree` 열만** 수정 |
| `post_packages` | 사용자 | 본인 행 읽기·쓰기 |

`cuts.image_path` 를 사용자가 고칠 수 있으면 남의 파일 경로를 적어 두고 서명 URL 을 받아 갈 수 있다.
그래서 열 단위 권한으로 `layer_tree` 만 열었다. 서명 URL 은 서버가 발급할 때도 `{owner}/` 로 시작하는
경로만 서명한다(`src/lib/supabase/storage.ts`) — 에셋의 `reference_paths` 처럼 사용자가 쓰는 열도 있어서다.

Storage 버킷 두 개는 비공개다. 업로드·삭제·서명 모두 서버가 서비스 롤로 한다. 그래서
`storage.objects` 에 사용자 정책을 두지 않는다.

| 버킷 | 경로 | 내용 |
|---|---|---|
| `cuts` | `{owner}/{episode}/{cut}.{ext}` | 생성된 컷 이미지 |
| `assets` | `{owner}/{asset}/…` | 에셋 레퍼런스, 캐릭터 시트 7장, 셀카 원본(기본 즉시 삭제) |

CI 의 맨 Postgres 에는 storage 스키마가 없어서 버킷 생성은 스키마가 있을 때만 돈다.

## 생성 큐 (0007)

오픈 이슈 11 결정: **Supabase Postgres 테이블을 큐로 쓴다.** 별도 큐 서비스·작업 서버 비용이 없다.

쉽게 말하면 식당 주문표다. 손님(사용자)이 "6컷 그려 주세요"라고 하면 주문표 6장을 `generation_tasks` 에
꽂아 두고 바로 "접수됐어요"라고 답한다. 요리사(작업자)는 주문표를 몇 장씩 집어 가서 그리고, 다 되면
표에 "완료"라고 적는다. 요리사가 중간에 쓰러져도 주문표는 꽂혀 있으니 다른 요리사가 3분 뒤 다시 집어 간다.

| 장치 | 하는 일 |
|---|---|
| `generation_tasks` | 컷 한 번의 시도가 한 행. 다시 만들면 새 행. 화면은 컷마다 가장 최근 행을 본다 |
| `claim_generation_tasks(limit, lease, per_job)` | 할 일을 꺼낸다. `FOR UPDATE SKIP LOCKED` 로 작업자 여럿이 같은 행을 두 번 못 가져가고, 한 잡에서 동시에 2컷까지만 |
| 임대(`lease_until`, 3분) | 작업자가 죽으면 지나서 다른 작업자가 가져간다. 그 전에 죽은 작업자가 잡아 둔 크레딧(`hold_id`)을 먼저 환불한다 |

작업자는 웹 서버 코드(`src/features/generation/queue/supabase.ts`)이고, 세 군데서 깨어난다.

1. 생성 요청 직후 — 서버 액션이 응답을 보내고 `after()` 로 처리한다(페이지 `maxDuration` 300초 안).
2. 진행률 폴링 — 대기 중인 컷이 있는데 아무도 안 돌고 있으면 `/api/jobs/:id` 가 깨운다.
3. 크론 — 사용자가 화면을 닫아도 마저 하도록 1분마다 `/api/queue/run` 을 부른다.

pgmq 를 쓰지 않은 이유: 컷마다 시도 기록(실패 사유·환불 여부)을 사용자가 RLS 로 읽어야 하는데 pgmq 메시지는
꺼내면 사라지고 사용자 권한으로 읽을 수 없다. 원리(SKIP LOCKED + 임대)는 같고, CI 의 맨 Postgres 에서도 돈다.

### 크론 설정 (환경마다 한 번)

pg_cron 과 pg_net 확장을 켜고(대시보드 → Database → Extensions), 앱 주소와 `CRON_SECRET` 을 Vault 에 넣은 뒤
아래를 실행한다. 비밀값을 SQL 에 직접 쓰지 않으려고 Vault 에서 읽는다.

```sql
select vault.create_secret('https://<앱 주소>', 'app_url');
select vault.create_secret('<CRON_SECRET 값>', 'cron_secret');

select cron.schedule('sharktoon-queue', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/queue/run',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 5000)
$$);

-- 하루 한 번(한국 시간 새벽 4시): 크레딧 만료, 탈퇴 30일 지난 계정 삭제
select cron.schedule('sharktoon-daily', '0 19 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/daily',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 5000)
$$);
```

크론 없이도 1·2번으로 생성은 돈다. 크론은 사용자가 화면을 닫은 잡과 만료·탈퇴 정리를 맡는다.

## 크레딧 묶음 (0008)

약관(제8조·제14조)이 약속한 차감 순서·이월·환불을 계산하려면 "얼마에 산 크레딧이 몇 개 남았는지"가 필요하다.
그래서 크레딧을 묶음(`credit_lots`)으로 나눴다.

- 차감: 무상 → 구독 → 구매, 같은 종류 안에서는 먼저 만료되는 것부터. hold 가 어느 묶음에서 얼마를 가져갔는지
  `credit_hold_lots` 에 남기고, 환불하면 같은 묶음으로 돌려준다.
- 만료: hold 직전과 하루 한 번(`credit_expire_all`) 기한 지난 묶음을 0 으로 만들고 `expiry` 거래를 남긴다.
- 구독 이월: 새 기간을 시작할 때(`credit_start_subscription_period`) 지난 구독분의 절반만 한 번 이월한다.
- 환불: `credit_refund_quote()` 가 유료 묶음 남은 수 × 산 단가 − 10% (결제 7일 안 미사용분은 공제 없음).
  신청(`request_credit_refund`)은 그 시점 견적을 남기고, 운영자가 승인(`admin_process_refund`)하면 유료 묶음을 비우고
  `refund_payout` 거래를 남긴다. 돈은 운영자가 결제 취소·이체로 돌려준다.
- 정책 값(출석·가입 보너스·유효기간·공제율)은 `credit_policy` 한 행이다. 배포 없이 바꾼다. 근거는 `docs/요금제_모델.md`.

지켜지는 식: `잔량 = 묶음 남은 수 합 = 거래 합`. 테스트 05 가 단계마다 확인한다.

### 오류 코드

| SQLSTATE | 뜻 | 앱에서 |
|---|---|---|
| `SK001` | 크레딧 부족 | `InsufficientCreditError` 로 바꿔 충전 시트를 연다 |
| `SK002` | 이미 정산되었거나 없는 hold | 재시도하지 않는다. 로그만 남긴다 |
| `SK003` | 오늘 이미 출석함 | 버튼을 완료 상태로 바꾼다 |
| `SK004` | 운영자 아님 | 관리자 화면이 빈 상태를 보여준다 |

## 로컬에서 검증하기

Supabase 없이 로컬 Postgres 만으로 마이그레이션과 RLS 를 돌려볼 수 있다.

```bash
initdb -D /tmp/skpg -U postgres --auth=trust
pg_ctl -D /tmp/skpg -o "-p 55432 -c listen_addresses=127.0.0.1" -l /tmp/skpg/server.log start
export PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres
createdb sharktoon && export PGDATABASE=sharktoon

psql -v ON_ERROR_STOP=1 -f supabase/tests/00_auth_stub.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done
psql -f supabase/tests/01_ledger_test.sql
psql -f supabase/tests/02_series_rls_test.sql
psql -f supabase/tests/03_admin_test.sql
psql -f supabase/tests/04_generation_test.sql
psql -f supabase/tests/05_credit_lots_test.sql
psql -f supabase/tests/06_queue_test.sql
```

`00_auth_stub.sql` 은 Supabase 의 기본 권한(새 테이블·함수에 anon·authenticated·service_role 부여)과
`service_role` 의 RLS 우회까지 흉내낸다. 그래야 마이그레이션의 `revoke` 가 실제로 막는지 볼 수 있다.
테스트 파일에서 `grant ... on all tables` 로 권한을 넓히면 그 검증이 가려지므로 하지 않는다.

`00_auth_stub.sql` 은 Supabase 의 `auth.users` 와 `auth.uid()` 를 흉내낸 것이고 **운영에는 적용하지 않는다**.
테스트는 사용자를 `set request.jwt.claim.sub` 로 바꿔가며 RLS 가 실제로 막는지 확인한다.

현재 통과하는 검증:

- 가입 트리거가 프로필과 8크레딧을 만든다
- hold → commit / hold → refund 후에도 원장 합계가 잔량과 같다
- 잔량보다 큰 요청과 중복 정산이 막힌다
- 7일 연속 출석에 4크레딧(1+3)이 들어온다
- 남의 비공개 시리즈는 안 보이고, 공개해도 **에셋은 보이지 않는다**
- 남의 시리즈는 수정되지 않고, 캐릭터 태그는 5개를 넘길 수 없다
- 운영자가 아니면 집계 함수가 SK004 로 막히고, 운영자로 올리면 깔때기·생성 지표·환불 내역이 나온다
- 사용자는 hold·commit·refund 를 직접 부를 수 없다(42501)
- 사용자는 생성 잡·컷을 만들 수 없고, 컷의 이미지 경로를 못 바꾸며, 남의 콘티·잡·컷·패키지가 안 보인다
- 크레딧은 무상 → 구독 → 구매 순으로 빠지고, 환불은 같은 묶음으로, 만료·이월·환불 견적이 약관대로 계산된다
- 출석은 한 달 상한을 넘겨 주지 않는다
- 큐는 같은 작업을 두 번 꺼내지 않고, 잡당 동시 2컷, 임대가 지난 작업은 회수한다

## 운영자 지정

집계는 `profiles.is_admin` 이 true 인 계정에만 열린다. RLS 를 넘어 여러 사용자를 가로지르므로
security definer 함수 안에서만 조회하고, 함수마다 먼저 권한을 확인한다.

```sql
update profiles set is_admin = true where id = '<운영자 uuid>';
```

첫 운영자는 대시보드에서 직접 넣는다. 화면에서 올릴 수 있게 만들면 그게 곧 권한 상승 경로가 된다.
