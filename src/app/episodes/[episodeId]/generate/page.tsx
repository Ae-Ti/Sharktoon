import { GenerationScreen } from "@/features/generation/components/GenerationScreen";
import { titlesOf } from "@/features/generation/episodeTitle";
import { getImageGenerator, usingMockGenerator } from "@/features/generation/image";
import { MOCK_JOB } from "@/features/generation/mocks/job";
import { getJob } from "@/features/generation/pipeline";
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

  const [context, live] = await Promise.all([
    loadEpisodeContext(episodeId),
    // 콘티에서 넘어오면 진짜 잡이 있다. 주소로 바로 들어오면 목을 보여준다.
    jobId ? getJob(jobId) : Promise.resolve(null),
  ]);

  return (
    <GenerationScreen
      initial={live ?? { ...MOCK_JOB, episodeId }}
      supportsInpainting={getImageGenerator().supportsInpainting()}
      usingMock={usingMockGenerator()}
      {...titlesOf(context)}
    />
  );
}
