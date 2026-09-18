import { CutEditorScreen } from "@/features/generation/components/CutEditorScreen";
import { getImageGenerator } from "@/features/generation/image";
import { MOCK_JOB_COMPLETED } from "@/features/generation/mocks/job";
import { MOCK_LAYER_TREE } from "@/features/generation/mocks/layers";
import { getJob } from "@/features/generation/pipeline";

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

  const live = jobId ? await getJob(jobId) : null;

  // 레이어 트리는 아직 저장소가 없다. 생성 결과가 있으면 그 이미지를 배경에 얹는다.
  const job = live ?? { ...MOCK_JOB_COMPLETED, episodeId };
  const tree = MOCK_LAYER_TREE;

  return (
    <CutEditorScreen
      job={job}
      tree={tree}
      supportsInpainting={getImageGenerator().supportsInpainting()}
    />
  );
}
