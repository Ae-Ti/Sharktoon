# Supabase

## 마이그레이션 적용

Supabase 프로젝트가 생기면 대시보드 SQL Editor 에 `migrations/` 의 파일을 번호순으로 붙여넣거나,
CLI 를 쓰면 `supabase link` 후 `supabase db push` 한다.

| 파일 | 내용 |
|---|---|
| `20260918000001_init.sql` | 확장, 열거형, `set_updated_at`, `profiles` |
| `20260918000002_credits.sql` | 크레딧 원장·hold 함수·출석, 가입 트리거 |
| `20260918000003_series_assets_episodes.sql` | 시리즈·생성 규칙·에셋·회차·참조 |

생성 파이프라인 테이블(`storyboards`, `cuts`, `layers`, `generation_jobs`)은 웅싯(A)이 다음 번호로 추가한다.

## 크레딧 원장이 이렇게 생긴 이유

생성은 실패한다. 실패율 목표가 3% 이하지 0% 가 아니다. 단순 차감이면 "차감했는데 워커가 죽은" 구간에서
원장이 틀어지고, 그게 곧 환불 분쟁이다. 그래서 3단으로 나눴다.

| 함수 | 하는 일 |
|---|---|
| `credit_hold(amount, reason, job_id)` | 잔량에서 빼고 `held` 로 옮기며 **소모 거래를 이때 기록**한다. hold id 를 돌려준다 |
| `credit_commit(hold_id)` | `held` 만 줄인다. 거래는 이미 있다 |
| `credit_refund(hold_id, reason)` | 잔량으로 되돌리고 환불 거래를 남긴다 |

덕분에 `sum(credit_transactions.amount)` 이 언제나 `credit_accounts.balance` 와 같다. 테스트 5번이 이걸 검증한다.

원장 테이블은 RLS 로 **읽기만** 열려 있다. 값이 바뀌는 길은 위 `security definer` 함수뿐이다.

### 오류 코드

| SQLSTATE | 뜻 | 앱에서 |
|---|---|---|
| `SK001` | 크레딧 부족 | `InsufficientCreditError` 로 바꿔 충전 시트를 연다 |
| `SK002` | 이미 정산되었거나 없는 hold | 재시도하지 않는다. 로그만 남긴다 |
| `SK003` | 오늘 이미 출석함 | 버튼을 완료 상태로 바꾼다 |

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
```

`00_auth_stub.sql` 은 Supabase 의 `auth.users` 와 `auth.uid()` 를 흉내낸 것이고 **운영에는 적용하지 않는다**.
테스트는 사용자를 `set request.jwt.claim.sub` 로 바꿔가며 RLS 가 실제로 막는지 확인한다.

현재 통과하는 검증:

- 가입 트리거가 프로필과 8크레딧을 만든다
- hold → commit / hold → refund 후에도 원장 합계가 잔량과 같다
- 잔량보다 큰 요청과 중복 정산이 막힌다
- 7일 연속 출석에 4크레딧(1+3)이 들어온다
- 남의 비공개 시리즈는 안 보이고, 공개해도 **에셋은 보이지 않는다**
- 남의 시리즈는 수정되지 않고, 캐릭터 태그는 5개를 넘길 수 없다
