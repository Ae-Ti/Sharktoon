import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRepository } from "@/features/platform/data";

export const metadata: Metadata = { title: "새 인스타툰 만들기 · 샥툰" };

export default async function NewEpisodePage({
  searchParams,
}: {
  searchParams: Promise<{ seriesId?: string }>;
}) {
  const { seriesId } = await searchParams;
  const repo = await getRepository();
  const allSeries = await repo.listSeries();
  const targetSeriesId = seriesId ?? allSeries[0]?.id;

  const res = await repo.startEpisode({
    story: "",
    cutCount: 4,
    seriesId: targetSeriesId,
  });

  redirect(`/episodes/${res.episodeId}/storyboard?new=1`);
}
