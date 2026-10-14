import { notFound, redirect } from "next/navigation";
import { CutEditorScreen } from "@/features/generation/components/CutEditorScreen";
import { getGenerationStore } from "@/features/generation/data";
import { buildLayerTree, hydrateLayerTree } from "@/features/generation/editor/buildLayerTree";
import { titlesOf } from "@/features/generation/episodeTitle";
import { getJob } from "@/features/generation/pipeline";
import { getRepository } from "@/features/platform/data";
import { loadEpisodeContext } from "@/features/platform/episode";

/** 이 화면의 서버 액션이 응답 뒤 생성 큐를 돌린다(`after`). 그 시간 상한. */
export const maxDuration = 300;

export const metadata = { title: "제작 & 편집 스튜디오 — 샥툰" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ episodeId: string }>;
  searchParams: Promise<{ cut?: string; job?: string }>;
}) {
  const { episodeId } = await params;
  const { cut: wanted, job: wantedJobId } = await searchParams;

  const context = await loadEpisodeContext(episodeId);
  if (!context) notFound();

  const repo = await getRepository();
  const [userId, credit] = await Promise.all([repo.currentUserId(), repo.getCredit()]);
  const store = await getGenerationStore();

  const [saved, records, rawJob] = await Promise.all([
    store.getStoryboard(episodeId),
    store.listCuts(episodeId),
    wantedJobId ? await getJob(wantedJobId, userId) : await store.getLatestJob(episodeId),
  ]);

  if (!saved) redirect(`/episodes/${episodeId}/storyboard`);

  const ready = records.filter((r) => r.imageUrl);

  // 생성 작업도 없고 이미지가 하나도 없으면 콘티부터 진행
  if (!rawJob && ready.length === 0) {
    redirect(`/episodes/${episodeId}/storyboard`);
  }

  // 콘티 컷 목록
  const sbCuts = saved.storyboard.cuts;
  if (sbCuts.length === 0) redirect(`/episodes/${episodeId}/storyboard`);

  // 열 컷 결정: wanted -> 첫 번째 완성 컷 -> 첫 번째 콘티 컷
  const wantedCut = wanted
    ? sbCuts.find((c) => c.id === wanted || String(c.index) === wanted)
    : null;
  const targetCut =
    wantedCut ??
    sbCuts.find((c) => ready.some((r) => r.cutId === c.id)) ??
    sbCuts[0];

  const targetRecord = records.find((r) => r.cutId === targetCut.id);
  const targetImageUrl = targetRecord?.imageUrl ?? "";

  const tree = targetRecord?.layerTree
    ? hydrateLayerTree(targetRecord.layerTree, targetCut.id, targetImageUrl)
    : buildLayerTree({
        storyboard: saved.storyboard,
        cut: targetCut,
        imageUrl: targetImageUrl,
        aspectRatio: context.rule.aspectRatio,
      });

  // 컷 스트립: 콘티 순서로 정렬하고 최신 잡의 컷 상태를 매핑
  const strip = sbCuts.map((c) => {
    const r = records.find((x) => x.cutId === c.id);
    const jobCut = rawJob?.cuts.find((jc) => jc.cutId === c.id);
    const cutTree = r?.imageUrl
      ? r.layerTree
        ? hydrateLayerTree(r.layerTree, c.id, r.imageUrl)
        : buildLayerTree({
            storyboard: saved.storyboard,
            cut: c,
            imageUrl: r.imageUrl,
            aspectRatio: context.rule.aspectRatio,
          })
      : null;

    return {
      cutId: c.id,
      index: c.index,
      imageUrl: r?.imageUrl ?? jobCut?.imageUrl ?? null,
      status: jobCut?.status ?? (r?.imageUrl ? "done" : "queued"),
      tree: cutTree,
    };
  });

  return (
    <CutEditorScreen
      // 컷을 바꾸면 편집기 상태(이력·선택)를 새로 시작한다.
      key={targetCut.id}
      episodeId={episodeId}
      jobId={rawJob?.id ?? null}
      initialJob={rawJob ?? null}
      storyboard={saved.storyboard}
      cuts={strip}
      tree={tree}
      credits={credit.balance}
      {...titlesOf(context)}
    />
  );
}
