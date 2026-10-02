import { notFound, redirect } from "next/navigation";
import { GenerationScreen } from "@/features/generation/components/GenerationScreen";
import { getGenerationStore } from "@/features/generation/data";
import { titlesOf } from "@/features/generation/episodeTitle";
import { getImageGenerator, usingMockGenerator } from "@/features/generation/image";
import { getJob } from "@/features/generation/pipeline";
import { getRepository } from "@/features/platform/data";
import { loadEpisodeContext } from "@/features/platform/episode";

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
  // 콘티에서 넘어오면 잡 id 가 있다. 주소로 바로 들어오면 이 회차의 마지막 잡을 보여준다.
  const job = jobId
    ? await getJob(jobId, userId)
    : await (await getGenerationStore()).getLatestJob(episodeId);

  // 아직 생성한 적이 없으면 콘티부터다.
  if (!job || job.episodeId !== episodeId) redirect(`/episodes/${episodeId}/storyboard`);

  return (
    <GenerationScreen
      initial={job}
      initialBalance={credit.balance}
      episodeNumber={context.number}
      supportsInpainting={getImageGenerator().supportsInpainting()}
      usingMock={usingMockGenerator()}
      {...titlesOf(context)}
    />
  );
}
