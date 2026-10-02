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

## 운영자 지정

집계는 `profiles.is_admin` 이 true 인 계정에만 열린다. RLS 를 넘어 여러 사용자를 가로지르므로
security definer 함수 안에서만 조회하고, 함수마다 먼저 권한을 확인한다.

```sql
update profiles set is_admin = true where id = '<운영자 uuid>';
```

첫 운영자는 대시보드에서 직접 넣는다. 화면에서 올릴 수 있게 만들면 그게 곧 권한 상승 경로가 된다.
