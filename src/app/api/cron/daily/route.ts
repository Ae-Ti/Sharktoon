import { purgeDeletedAccounts } from "@/features/platform/account/purge";
import { refreshExpiringTokens } from "@/features/platform/instagram/accounts";
import { instagramAvailable } from "@/features/platform/instagram/config";
import { purgeOldSafetyEvents } from "@/features/generation/safety/strikes";
import { isCronRequest } from "@/lib/cronAuth";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 300;

/**
 * 하루 한 번 도는 운영 배치. Supabase pg_cron 이 부른다.
 * - 기한이 지난 크레딧 묶음 만료(약관 제8조)
 * - 탈퇴 요청 후 30일이 지난 계정과 파일 삭제(약관 제14조, 처리방침 4항)
 * - 만료가 가까운 인스타 장기 토큰 갱신(60일, 갱신하지 않으면 다시 로그인해야 한다)
 * - 1년이 지난 콘텐츠 안전 판정 기록 삭제(처리방침 보관 기간)
 */
export async function POST(request: Request) {
  if (!isCronRequest(request)) return new Response("forbidden", { status: 403 });
  const db = createServiceClient();
  const { data: expired, error } = await db.rpc("credit_expire_all");
  if (error) throw error;
  const purged = await purgeDeletedAccounts();
  const refreshedTokens = instagramAvailable() ? await refreshExpiringTokens() : 0;
  const purgedSafetyEvents = await purgeOldSafetyEvents();
  return Response.json({ expiredCredits: Number(expired ?? 0), purgedAccounts: purged, refreshedTokens, purgedSafetyEvents });
}
