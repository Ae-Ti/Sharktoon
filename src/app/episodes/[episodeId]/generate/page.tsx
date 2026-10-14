import { notFound, redirect } from "next/navigation";
import { GenerationScreen } from "@/features/generation/components/GenerationScreen";
import { getGenerationStore } from "@/features/generation/data";
import { titlesOf } from "@/features/generation/episodeTitle";
import { getImageGenerator, usingMockGenerator } from "@/features/generation/image";
import { getJob } from "@/features/generation/pipeline";
import { getRepository } from "@/features/platform/data";
import { loadEpisodeContext } from "@/features/platform/episode";

/** 이 화면의 서버 액션이 응답 뒤 생성 큐를 돌린다(`after`). 그 시간 상한. */
export const maxDuration = 300;

export const metadata = { title: "이미지 생성 — 샥툰" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ episodeId: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  const { episodeId } = await params;
  const { job: jobId } = await searchParams;

  const context = await loadEpisodeContext(episodeId);
  if (!context) notFound();

  const repo = await getRepository();
  const [userId, credit] = await Promise.all([repo.currentUserId(), repo.getCredit()]);
  const store = await getGenerationStore();
  const [saved, rawJob] = await Promise.all([
    store.getStoryboard(episodeId),
    jobId ? await getJob(jobId, userId) : await store.getLatestJob(episodeId),
  ]);

  // 아직 생성한 적이 없으면 콘티부터다.
  if (!rawJob || rawJob.episodeId !== episodeId) redirect(`/episodes/${episodeId}/storyboard`);

  // 콘티에서 삭제된 컷은 생성 화면에서도 동기화하여 제외
  const activeCutMap = new Map(saved?.storyboard.cuts.map((c) => [c.id, c.index]));
  const synchronizedJob = saved
    ? {
        ...rawJob,
        cuts: rawJob.cuts
          .filter((c) => activeCutMap.has(c.cutId))
          .map((c) => ({ ...c, index: activeCutMap.get(c.cutId) ?? c.index })),
      }
    : rawJob;

  return (
    <GenerationScreen
      initial={synchronizedJob}
      initialBalance={credit.balance}
      episodeNumber={context.number}
      supportsInpainting={getImageGenerator().supportsInpainting()}
      usingMock={usingMockGenerator()}
      {...titlesOf(context)}
    />
  );
}
