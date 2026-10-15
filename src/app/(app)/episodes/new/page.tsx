import type { Metadata } from "next";
import { getRepository } from "@/features/platform/data";
import { NewEpisodeForm } from "@/features/platform/episodes/NewEpisodeForm";

export const metadata: Metadata = { title: "새 에피소드 만들기 · 샥툰" };

export default async function NewEpisodePage({
  searchParams,
}: {
  searchParams: Promise<{ seriesId?: string }>;
}) {
  const { seriesId } = await searchParams;
  const repo = await getRepository();
  const allSeries = await repo.listSeries();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-title-lg font-bold">새 인스타툰 만들기</h1>
        <p className="text-body-sm text-ink-muted">
          사연을 입력하면 기존에 등록된 캐릭터와 화풍을 유지하여 컷별 콘티를 자동으로 완성해 드려요.
        </p>
      </div>

      <NewEpisodeForm allSeries={allSeries} initialSeriesId={seriesId ?? null} />
    </div>
  );
}
