import { after } from "next/server";
import { getRepository } from "@/features/platform/data";
import { drainQueue, getJob } from "@/features/generation/pipeline";

/** 폴링 요청이 작업자를 깨웠을 때 쓸 수 있는 시간. */
export const maxDuration = 300;

/**
 * 잡 진행 상태 폴링. Supabase Realtime 이 붙으면(PRD 부록 A) 이 라우트는
 * 첫 로드용으로만 남고 이후 갱신은 푸시로 받는다.
 *
 * 크레딧 잔량을 같이 준다 — 컷이 끝날 때마다 바뀌는 값이라 헤더가 따라가야 한다.
 *
 * 대기 중인 컷이 있는데 아무도 처리하고 있지 않으면 여기서 작업자를 깨운다.
 * 요청 뒤 작업자(`after`)가 시간이 다 돼 멈췄거나 크론이 아직 안 돈 경우를 메운다.
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

  const stalled =
    job.cuts.some((c) => c.status === "queued") && !job.cuts.some((c) => c.status === "running");
  if (stalled) {
    after(async () => {
      try {
        await drainQueue();
      } catch (e) {
        console.error("[generation] 폴링에서 큐 처리 실패", e);
      }
    });
  }

  const { balance } = await repo.getCredit();
  // 진행 중인 잡은 캐시하면 안 된다.
  return Response.json({ job, balance }, { headers: { "Cache-Control": "no-store" } });
}
