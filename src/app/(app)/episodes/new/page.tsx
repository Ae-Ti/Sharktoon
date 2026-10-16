import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRepository } from "@/features/platform/data";
import { NewEpisodeSeriesSelector } from "@/features/platform/episodes/NewEpisodeSeriesSelector";

export const metadata: Metadata = { title: "새 인스타툰 만들기 · 샥툰" };

export default async function NewEpisodePage({
  searchParams,
}: {
  searchParams: Promise<{ seriesId?: string }>;
}) {
  const { seriesId } = await searchParams;
  const repo = await getRepository();

  // 특정 시리즈에서 새 회차 생성을 명시적으로 요청한 경우 즉시 생성 후 이동
  if (seriesId) {
    const res = await repo.startEpisode({
      story: "",
      cutCount: 4,
      seriesId,
    });

    redirect(`/episodes/${res.episodeId}/storyboard?new=1`);
  }

  // 시리즈가 지정되지 않은 경우(예: 홈의 '새 인스타툰 만들기' 버튼 클릭 시),
  // 기존 시리즈 중 하나로 임의 자동 지정하지 않고 사용자가 직접 새 작품을 만들거나 기존 작품을 선택하도록 한다.
  const allSeries = await repo.listSeries();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-2">
      <NewEpisodeSeriesSelector allSeries={allSeries} />
    </div>
  );
}
