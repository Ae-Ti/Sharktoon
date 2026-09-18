import type { Metadata } from "next";
import { getRepository, type AssetKind } from "@/features/platform/data";
import { AssetLibrary } from "@/features/platform/assets/AssetLibrary";

export const metadata: Metadata = { title: "에셋 라이브러리 · 샥툰" };

export default async function Page() {
  const repo = await getRepository();
  const [assets, counts] = await Promise.all([
    repo.listAssets(),
    repo.countAssetsByKind(),
  ]);

  const order: AssetKind[] = ["character", "location", "prop", "style"];

  return <AssetLibrary assets={assets} counts={counts} order={order} />;
}
