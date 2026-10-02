import { notFound, redirect } from "next/navigation";
import { PublishScreen } from "@/features/generation/components/PublishScreen";
import { getGenerationStore } from "@/features/generation/data";
import { buildLayerTree, hydrateLayerTree } from "@/features/generation/editor/buildLayerTree";
import { titlesOf } from "@/features/generation/episodeTitle";
import { getRepository } from "@/features/platform/data";
import { loadEpisodeContext } from "@/features/platform/episode";

export const metadata = { title: "게시 준비 — 샥툰" };

/** PRD 4.1 — 인스타 게시물 패키지. 캡션·해시태그·첫 댓글과 캐러셀 ZIP. */
export default async function Page({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params;
  const context = await loadEpisodeContext(episodeId);
  if (!context) notFound();

  const store = await getGenerationStore();
  const repo = await getRepository();
  const [saved, records, pkg, credit, profile, series] = await Promise.all([
    store.getStoryboard(episodeId),
    store.listCuts(episodeId),
    store.getPostPackage(episodeId),
    repo.getCredit(),
    repo.getProfile(),
    repo.getSeries(context.seriesId),
  ]);
  if (!saved) redirect(`/episodes/${episodeId}/storyboard`);

  // 캐러셀 순서는 콘티 순서다. 저장된 레이어가 없으면 편집기와 같은 규칙으로 처음 트리를 만든다.
  const slides = saved.storyboard.cuts.map((cut) => {
    const r = records.find((x) => x.cutId === cut.id);
    if (!r?.imageUrl) return { cutId: cut.id, index: cut.index, imageUrl: null, tree: null };
    const tree = r.layerTree
      ? hydrateLayerTree(r.layerTree, cut.id, r.imageUrl)
      : buildLayerTree({
          storyboard: saved.storyboard,
          cut,
          imageUrl: r.imageUrl,
          aspectRatio: context.rule.aspectRatio,
        });
    return { cutId: cut.id, index: cut.index, imageUrl: r.imageUrl, tree };
  });

  const status = series?.episodes.find((e) => e.id === episodeId)?.status;

  return (
    <PublishScreen
      episodeId={episodeId}
      seriesId={context.seriesId}
      slides={slides}
      initialPackage={pkg}
      defaultRatio={context.rule.aspectRatio}
      // 무료 요금제는 워터마크(요금제 정책). 프로필을 못 읽으면 무료로 본다.
      watermark={(profile?.plan ?? "free") === "free"}
      published={status === "published"}
      credits={credit.balance}
      {...titlesOf(context)}
    />
  );
}
