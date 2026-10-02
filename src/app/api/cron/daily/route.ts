import { purgeDeletedAccounts } from "@/features/platform/account/purge";
import { isCronRequest } from "@/lib/cronAuth";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 300;

/**
 * 하루 한 번 도는 운영 배치. Supabase pg_cron 이 부른다.
 * - 기한이 지난 크레딧 묶음 만료(약관 제8조)
 * - 탈퇴 요청 후 30일이 지난 계정과 파일 삭제(약관 제14조, 처리방침 4항)
 */
export async function POST(request: Request) {
  if (!isCronRequest(request)) return new Response("forbidden", { status: 403 });
  const db = createServiceClient();
  const { data: expired, error } = await db.rpc("credit_expire_all");
  if (error) throw error;
  const purged = await purgeDeletedAccounts();
  return Response.json({ expiredCredits: Number(expired ?? 0), purgedAccounts: purged });
}
