import { notFound } from "next/navigation";
import { StoryboardScreen } from "@/features/generation/components/StoryboardScreen";
import { getGenerationStore } from "@/features/generation/data";
import { titlesOf } from "@/features/generation/episodeTitle";
import { isAnthropicConfigured } from "@/features/generation/llm";
import { getRepository } from "@/features/platform/data";
import { loadEpisodeContext } from "@/features/platform/episode";

/** 이 화면의 서버 액션이 응답 뒤 생성 큐를 돌린다(`after`). 그 시간 상한. */
export const maxDuration = 300;

export const metadata = { title: "콘티 — 샥툰" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ episodeId: string }>;
  searchParams?: Promise<{ new?: string }>;
}) {
  const { episodeId } = await params;
  const sParams = await searchParams;
  const context = await loadEpisodeContext(episodeId);
  if (!context) notFound();

  const repo = await getRepository();
  const [saved, credit, allSeries] = await Promise.all([
    (await getGenerationStore()).getStoryboard(episodeId),
    repo.getCredit(),
    repo.listSeries(),
  ]);

  return (
    <StoryboardScreen
      // 콘티가 아직 없으면 화면이 열리자마자 만든다. 페이지를 30초 붙잡아 두지 않는다.
      initial={saved?.storyboard ?? null}
      usedMock={saved?.usedMock ?? !isAnthropicConfigured()}
      episodeId={episodeId}
      story={context.story}
      fixedCharacters={context.assets.filter((a) => a.kind === "character").map((a) => a.name)}
      stylePreset={context.rule.stylePreset}
      aspectRatio={context.rule.aspectRatio}
      credits={credit.balance}
      seriesId={context.seriesId}
      cutCount={context.cutCount}
      allSeries={allSeries}
      isNewDraft={sParams?.new === "1"}
      {...titlesOf(context)}
    />
  );
}
