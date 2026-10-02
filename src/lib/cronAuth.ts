import "server-only";

/**
 * 크론 라우트 인증. Supabase pg_cron(pg_net) 이 `Authorization: Bearer <CRON_SECRET>` 로 부른다.
 * 비밀값이 설정돼 있지 않으면 아무도 못 부른다.
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
