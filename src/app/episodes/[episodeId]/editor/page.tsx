import { CutEditorScreen } from "@/features/generation/components/CutEditorScreen";
import { titlesOf } from "@/features/generation/episodeTitle";
import { getImageGenerator } from "@/features/generation/image";
import { MOCK_JOB_COMPLETED } from "@/features/generation/mocks/job";
import { MOCK_LAYER_TREE } from "@/features/generation/mocks/layers";
import { getJob } from "@/features/generation/pipeline";
import { loadEpisodeContext } from "@/features/platform/episode";

export const metadata = { title: "컷 편집 — 샥툰" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ episodeId: string }>;
  searchParams: Promise<{ job?: string; cut?: string }>;
}) {
  const { episodeId } = await params;
  const { job: jobId } = await searchParams;

  const [context, live] = await Promise.all([
    loadEpisodeContext(episodeId),
    jobId ? getJob(jobId) : Promise.resolve(null),
  ]);

  // 레이어 트리 저장소는 아직 없다. 컷 스트립만 실제 생성 결과를 쓴다.
  return (
    <CutEditorScreen
      job={live ?? { ...MOCK_JOB_COMPLETED, episodeId }}
      tree={MOCK_LAYER_TREE}
      supportsInpainting={getImageGenerator().supportsInpainting()}
      {...titlesOf(context)}
    />
  );
}
