import { CutEditorScreen } from "@/features/generation/components/CutEditorScreen";
import { MOCK_JOB_COMPLETED } from "@/features/generation/mocks/job";
import { MOCK_LAYER_TREE } from "@/features/generation/mocks/layers";

export const metadata = { title: "컷 편집 — 샥툰" };

export default async function Page({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  // 컷 스트립은 잡에서, 캔버스는 레이어 트리에서 온다. 둘 다 목이다.
  return (
    <CutEditorScreen job={{ ...MOCK_JOB_COMPLETED, episodeId }} tree={MOCK_LAYER_TREE} />
  );
}
