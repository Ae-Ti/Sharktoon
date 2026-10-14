import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, Edit3, Share2, Layers, CheckCircle2 } from "lucide-react";
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
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-brand-tint text-brand">
            <CheckCircle2 className="size-3.5" />
          </span>
          <h1 className="text-display font-bold tracking-[-0.015em]">
            {ctx.number === 1 ? "첫 화가 완성됐어요!" : `${ctx.number}화가 완성됐어요!`}
          </h1>
        </div>
        <p className="text-body-sm text-ink-muted">
          인스타그램 캐러셀 순서 그대로예요. 컷을 눌러 대사와 레이어를 편집할 수 있어요.
        </p>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {cuts.map((c) => (
          <Link
            key={c.id}
            href={`/episodes/${ctx.episodeId}/editor?cut=${c.id}`}
            className="group flex w-44 shrink-0 flex-col gap-1.5 cursor-pointer"
          >
            {c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.imageUrl}
                alt={`${c.no}컷 · ${c.role}`}
                className={`${ctx.rule.aspectRatio === "4:5" ? "aspect-[4/5]" : "aspect-square"} w-full rounded-xl border border-border/80 object-cover shadow-2xs group-hover:border-brand group-hover:shadow-xs transition-all`}
              />
            ) : (
              <span className="grid aspect-square place-items-center rounded-xl border border-border/80 bg-surface-sunken text-caption text-ink-subtle">
                {c.no}컷 · 준비 중
              </span>
            )}
            <div className="flex items-center justify-between px-0.5 text-caption text-ink-muted">
              <span className="font-medium text-ink group-hover:text-brand transition-colors">
                {c.no}컷
              </span>
              <Badge tone="neutral" className="text-[10px] px-1.5 py-0">{c.role}</Badge>
            </div>
          </Link>
        ))}
      </div>

      {ctx.assets.length === 0 && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface-card p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-label font-semibold">시리즈로 이어갈까요?</span>
            <Badge tone="brand">추천</Badge>
          </div>
          <p className="text-body-sm text-ink-muted leading-relaxed">
            캐릭터와 그림체를 에셋으로 등록해 두면 2화부터는 사연만 적어도 그림체가 유지돼요.
          </p>
          <ButtonLink href="/assets" variant="secondary" block>
            에셋 등록하기
          </ButtonLink>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-2.5">
        <ButtonLink
          href={`/episodes/${ctx.episodeId}/publish`}
          size="lg"
          block
          className="gap-2 shadow-xs"
        >
          <Share2 className="size-4" />
          게시 준비하기
        </ButtonLink>
        <ButtonLink
          href={`/episodes/${ctx.episodeId}/editor`}
          variant="secondary"
          block
          className="gap-2"
        >
          <Edit3 className="size-4" />
          편집기에서 다듬기
        </ButtonLink>
        <ButtonLink href={`/series/${ctx.seriesId}`} variant="ghost" block>
          시리즈에서 보기
        </ButtonLink>
      </div>
    </>
  );
}
