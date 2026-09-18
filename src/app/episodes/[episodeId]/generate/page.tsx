import { GenerationScreen } from "@/features/generation/components/GenerationScreen";
import { getImageGenerator, usingMockGenerator } from "@/features/generation/image";
import { MOCK_JOB } from "@/features/generation/mocks/job";
import { getJob } from "@/features/generation/pipeline";

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

  // 콘티에서 넘어오면 진짜 잡이 있다. 주소로 바로 들어오면 목을 보여준다.
  const live = jobId ? await getJob(jobId) : null;

  return (
    <GenerationScreen
      initial={live ?? { ...MOCK_JOB, episodeId }}
      supportsInpainting={getImageGenerator().supportsInpainting()}
      usingMock={usingMockGenerator()}
    />
  );
}
