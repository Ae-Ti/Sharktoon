import { drainQueue } from "@/features/generation/pipeline";
import { isCronRequest } from "@/lib/cronAuth";

export const maxDuration = 300;

/**
 * 생성 큐 작업자. Supabase pg_cron 이 1분마다 부른다(설정: supabase/README.md "크론").
 * 사용자가 화면을 닫아 폴링이 멈춘 잡, 작업자가 죽어 임대가 지난 컷을 여기서 마저 처리한다.
 */
export async function POST(request: Request) {
  if (!isCronRequest(request)) return new Response("forbidden", { status: 403 });
  const processed = await drainQueue(240_000);
  return Response.json({ processed });
}
