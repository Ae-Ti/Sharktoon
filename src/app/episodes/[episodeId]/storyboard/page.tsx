import { StoryboardScreen } from "@/features/generation/components/StoryboardScreen";
import { titlesOf } from "@/features/generation/episodeTitle";
import { MOCK_STORYBOARD } from "@/features/generation/mocks/storyboard";
import { loadEpisodeContext } from "@/features/platform/episode";

export const metadata = { title: "콘티 — 샥툰" };

export default async function Page({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  const context = await loadEpisodeContext(episodeId);

  // 콘티 저장소가 붙기 전까지는 목 콘티에 회차의 사연만 얹는다.
  const initial = {
    ...MOCK_STORYBOARD,
    episodeId,
    seriesId: context?.seriesId ?? MOCK_STORYBOARD.seriesId,
    story: context?.story ?? MOCK_STORYBOARD.story,
  };

  return <StoryboardScreen initial={initial} {...titlesOf(context)} />;
}
