import { getJob } from "@/features/generation/pipeline";

/**
 * 잡 진행 상태 폴링. Supabase Realtime 이 붙으면(PRD 부록 A) 이 라우트는
 * 첫 로드용으로만 남고 이후 갱신은 푸시로 받는다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job) {
    return Response.json({ error: "없는 잡이에요" }, { status: 404 });
  }

  // 진행 중인 잡은 캐시하면 안 된다.
  return Response.json(job, { headers: { "Cache-Control": "no-store" } });
}
