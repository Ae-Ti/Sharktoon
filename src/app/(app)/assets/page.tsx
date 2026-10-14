import type { Metadata } from "next";
import { getRepository, type AssetKind } from "@/features/platform/data";
import { AssetLibrary } from "@/features/platform/assets/AssetLibrary";

export const metadata: Metadata = { title: "에셋 라이브러리 · 샥툰" };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ series?: string }>;
}) {
  const sp = await searchParams;
  const initialSeriesId = sp?.series ?? null;

  const repo = await getRepository();
  const [assets, counts, allSeries] = await Promise.all([
    repo.listAssets(),
    repo.countAssetsByKind(),
    repo.listSeries(),
  ]);

  const seriesList = await Promise.all(
    allSeries.map(async (s) => {
      const detail = await repo.getSeries(s.id);
      return {
        id: s.id,
        title: s.title,
        assetIds: detail ? detail.assets.map((a) => a.id) : [],
      };
    }),
  );

  const order: AssetKind[] = ["character", "location", "prop", "style"];

  return (
    <AssetLibrary
      assets={assets}
      counts={counts}
      order={order}
      seriesList={seriesList}
      initialSeriesId={initialSeriesId}
    />
  );
}

