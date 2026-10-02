import { notFound, redirect } from "next/navigation";
import { CutEditorScreen } from "@/features/generation/components/CutEditorScreen";
import { getGenerationStore } from "@/features/generation/data";
import { buildLayerTree, hydrateLayerTree } from "@/features/generation/editor/buildLayerTree";
import { titlesOf } from "@/features/generation/episodeTitle";
import { getImageGenerator } from "@/features/generation/image";
import { getRepository } from "@/features/platform/data";
import { loadEpisodeContext } from "@/features/platform/episode";

/** 이 화면의 서버 액션이 응답 뒤 생성 큐를 돌린다(`after`). 그 시간 상한. */
export const maxDuration = 300;

export const metadata = { title: "컷 편집 — 샥툰" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ episodeId: string }>;
  searchParams: Promise<{ cut?: string }>;
}) {
  const { episodeId } = await params;
  const { cut: wanted } = await searchParams;

  const context = await loadEpisodeContext(episodeId);
  if (!context) notFound();

  const store = await getGenerationStore();
  const [saved, records, credit] = await Promise.all([
    store.getStoryboard(episodeId),
    store.listCuts(episodeId),
    (await getRepository()).getCredit(),
  ]);
  if (!saved) redirect(`/episodes/${episodeId}/storyboard`);

  const ready = records.filter((r) => r.imageUrl);
  // 이미지가 하나도 없으면 편집할 것이 없다.
  if (ready.length === 0) redirect(`/episodes/${episodeId}/generate`);

  // ?cut= 은 컷 id 또는 컷 번호(온보딩 결과 화면이 번호로 보낸다).
  const open =
    ready.find((r) => r.cutId === wanted) ??
    ready.find((r) => String(r.index) === wanted) ??
    ready[0];

  const sbCut = saved.storyboard.cuts.find((c) => c.id === open.cutId);
  const tree = open.layerTree
    ? hydrateLayerTree(open.layerTree, open.cutId, open.imageUrl!)
    : sbCut
      ? buildLayerTree({
          storyboard: saved.storyboard,
          cut: sbCut,
          imageUrl: open.imageUrl!,
          aspectRatio: context.rule.aspectRatio,
        })
      : null;
  if (!tree) redirect(`/episodes/${episodeId}/generate`);

  // 컷 스트립은 콘티 순서다. 아직 이미지가 없는 컷도 자리를 보여준다.
  const strip = saved.storyboard.cuts.map((c) => {
    const r = records.find((x) => x.cutId === c.id);
    return { cutId: c.id, index: c.index, imageUrl: r?.imageUrl ?? null };
  });

  return (
    <CutEditorScreen
      // 컷을 바꾸면 편집기 상태(이력·선택)를 새로 시작한다.
      key={open.cutId}
      episodeId={episodeId}
      cuts={strip}
      tree={tree}
      credits={credit.balance}
      supportsInpainting={getImageGenerator().supportsInpainting()}
      {...titlesOf(context)}
    />
  );
}
