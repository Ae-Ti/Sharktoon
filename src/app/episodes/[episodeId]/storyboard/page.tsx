import { StoryboardScreen } from "@/features/generation/components/StoryboardScreen";
import { MOCK_STORYBOARD } from "@/features/generation/mocks/storyboard";

export const metadata = { title: "콘티 — 샥툰" };

export default async function Page({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  // 목 데이터다. API 가 붙으면 episodeId 로 콘티를 읽어 그대로 넘긴다.
  return <StoryboardScreen initial={{ ...MOCK_STORYBOARD, episodeId }} />;
}
