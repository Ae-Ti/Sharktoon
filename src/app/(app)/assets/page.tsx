import type { Metadata } from "next";
import { getRepository, type AssetKind } from "@/features/platform/data";
import { AssetLibrary } from "@/features/platform/assets/AssetLibrary";

export const metadata: Metadata = { title: "소재 보관함 · 샥툰" };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ series?: string }>;
}) {
  const sp = await searchParams;
  const initialSeriesId = sp?.series ?? null;

  const repo = await getRepository();
  const [allAssets, counts, allSeries] = await Promise.all([
    repo.listAssets(),
    repo.countAssetsByKind(),
    repo.listSeries(),
  ]);

  // '스타일'은 작품 설정에서 단일 관리되므로 소재 목록에서는 제외
  const assets = allAssets.filter((a) => a.kind !== "style");

  const seriesList = await Promise.all(
    allSeries.map(async (s) => {
      const detail = await repo.getSeries(s.id);
      return {
        id: s.id,
        title: s.title,
        assetIds: detail ? detail.assets.map((a) => a.id) : [],
        stylePreset: detail?.rule.stylePreset ?? "심플 라인",
        customStyleImageUrl: detail?.rule.customStyleImageUrl ?? null,
      };
    }),
  );

  const order: AssetKind[] = ["character", "location", "prop"];

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

