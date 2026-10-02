import { getRepository } from "@/features/platform/data";
import { getJob } from "@/features/generation/pipeline";

/**
 * 잡 진행 상태 폴링. Supabase Realtime 이 붙으면(PRD 부록 A) 이 라우트는
 * 첫 로드용으로만 남고 이후 갱신은 푸시로 받는다.
 *
 * 진행 중인 잡은 메모리에 있어 RLS 를 거치지 않는다. 소유자 확인은 getJob 이 한다.
 * 크레딧 잔량을 같이 준다 — 컷이 끝날 때마다 바뀌는 값이라 헤더가 따라가야 한다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const repo = await getRepository();
  const job = await getJob(jobId, await repo.currentUserId());

  if (!job) {
    return Response.json({ error: "없는 잡이에요" }, { status: 404 });
  }

  const { balance } = await repo.getCredit();
  // 진행 중인 잡은 캐시하면 안 된다.
  return Response.json({ job, balance }, { headers: { "Cache-Control": "no-store" } });
}
