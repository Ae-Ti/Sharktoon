import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink } from "@/components/ui";
import { getGenerationStore } from "@/features/generation/data";
import { loadEpisodeContext } from "@/features/platform/episode";

/**
 * 온보딩 4단계 — 첫 화 결과.
 * 생성이 끝난 회차 id 를 받아야 한다. 웅싯의 생성 화면이 여기로 보낸다.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ episode?: string }>;
}) {
  const { episode } = await searchParams;
  if (!episode) notFound();

  const ctx = await loadEpisodeContext(episode);
  if (!ctx) notFound();

  const store = await getGenerationStore();
  const [saved, records] = await Promise.all([
    store.getStoryboard(ctx.episodeId),
    store.listCuts(ctx.episodeId),
  ]);
  // 콘티 순서대로. 1컷은 후킹, 마지막 컷은 CTA 다.
  const sbCuts = saved?.storyboard.cuts ?? [];
  const cuts = sbCuts.map((c, i) => ({
    id: c.id,
    no: c.index,
    role: i === 0 ? "후킹" : i === sbCuts.length - 1 ? "CTA" : "전개",
    imageUrl: records.find((r) => r.cutId === c.id)?.imageUrl ?? null,
  }));

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-display font-bold tracking-[-0.015em]">
          {ctx.number === 1 ? "첫 화가 완성됐어요" : `${ctx.number}화가 완성됐어요`}
        </h1>
        <p className="text-body-sm text-ink-muted">
          인스타 캐러셀 순서 그대로예요. 컷을 눌러 고칠 수 있어요.
        </p>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {cuts.map((c) => (
          <Link
            key={c.id}
            href={`/episodes/${ctx.episodeId}/editor?cut=${c.id}`}
            className="flex w-44 shrink-0 flex-col gap-1.5"
          >
            {c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.imageUrl}
                alt={`${c.no}컷 · ${c.role}`}
                className={`${ctx.rule.aspectRatio === "4:5" ? "aspect-[4/5]" : "aspect-square"} w-full rounded-lg border border-border object-cover`}
              />
            ) : (
              <span className="grid aspect-square place-items-center rounded-lg border border-border bg-skeleton text-caption text-ink-subtle">
                {c.no}컷 · 아직 없음
              </span>
            )}
            <span className="text-caption text-ink-muted">
              {c.no} / {cuts.length} · {c.role}
            </span>
          </Link>
        ))}
      </div>

      {/* AI 라벨은 이미지 위에 얹지 않고 바로 아래 메타 줄에 둔다. */}
      <div className="flex items-center gap-2">
        <Badge tone="ai">AI 생성</Badge>
        <span className="text-caption text-ink-muted">{ctx.rule.aspectRatio}</span>
      </div>

      {ctx.assets.length === 0 && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-label font-semibold">시리즈로 이어갈까요?</span>
            <Badge tone="brand">추천</Badge>
          </div>
          <p className="text-body-sm text-ink-muted">
            캐릭터와 그림체를 에셋으로 저장해 두면 2화부터는 사연만 적으면 돼요.
          </p>
          <ButtonLink href="/assets" variant="secondary" block>
            에셋 등록하기
          </ButtonLink>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-2">
        <ButtonLink href={`/episodes/${ctx.episodeId}/publish`} size="lg" block>
          게시 준비하기
        </ButtonLink>
        <ButtonLink href={`/episodes/${ctx.episodeId}/editor`} variant="secondary" block>
          대사 먼저 다듬기
        </ButtonLink>
        <ButtonLink href={`/series/${ctx.seriesId}`} variant="ghost" block>
          시리즈에서 보기
        </ButtonLink>
      </div>
    </>
  );
}
