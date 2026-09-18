import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, ButtonLink } from "@/components/ui";
import { getRepository } from "@/features/platform/data";
import type { EpisodeStatus } from "@/features/platform/data/types";

export const metadata: Metadata = { title: "시리즈 · 샥툰" };

const STATUS_LABEL: Record<EpisodeStatus, string> = {
  draft: "초안",
  storyboard: "콘티",
  generating: "생성 중",
  ready: "완성",
  published: "게시함",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  const repo = await getRepository();
  const series = await repo.getSeries(seriesId);
  if (!series) notFound();

  const next = Math.max(0, ...series.episodes.map((e) => e.number)) + 1;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-title-lg font-bold">{series.title}</h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{series.rule.stylePreset}</Badge>
            <Badge>{series.rule.defaultCutCount}컷 기본</Badge>
            <Badge>{series.rule.aspectRatio}</Badge>
            {series.rule.tone && <Badge>{series.rule.tone}</Badge>}
            <Badge>에셋 {series.assets.length}</Badge>
          </div>
        </div>
        <Button variant="secondary">생성 규칙 수정</Button>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-title font-semibold">회차</h2>
        <ul className="flex gap-4 overflow-x-auto pb-1">
          {series.episodes.map((e) => (
            <li key={e.id} className="w-45 shrink-0">
              <Link
                href={`/episodes/${e.id}/editor`}
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-card text-ink hover:border-border-control"
              >
                <span className="grid h-40 place-items-center bg-skeleton text-caption text-ink-subtle">
                  {e.status === "published" ? "대표 컷" : "아직 없음"}
                </span>
                <span className="flex flex-col gap-1.5 p-3">
                  <span className="text-body font-semibold">
                    {e.number}화{e.title ? ` · ${e.title}` : ""}
                  </span>
                  <span className="text-caption text-ink-muted">
                    {STATUS_LABEL[e.status]}
                    {formatDate(e.publishedAt) ? ` · ${formatDate(e.publishedAt)}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}

          {/* 다음 화 제안. 성과 연동 전에는 근거를 솔직하게 밝힌다. */}
          <li className="flex w-60 shrink-0 flex-col gap-2.5 rounded-lg border border-brand bg-brand-tint p-4">
            <Badge tone="brand">다음 화 제안</Badge>
            <p className="text-body-sm text-ink">
              지난 회차에서 이어지는 소재로 {next}화를 시작할 수 있어요.
            </p>
            <div className="flex-1" />
            <ButtonLink href="/onboarding/story" size="sm" block>
              {next}화 시작하기
            </ButtonLink>
            <p className="text-[11px] leading-4 text-ink-muted">
              성과 기반 제안은 인스타 연동 후 정확해져요.
            </p>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-surface-card p-5">
          <h2 className="text-title font-semibold">에셋 참조</h2>
          <p className="text-body-sm text-ink-muted">
            이 시리즈의 모든 회차에 아래 에셋이 고정 레퍼런스로 들어가요.
          </p>
          <ul className="flex flex-wrap gap-2.5">
            {series.assets.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-label"
              >
                <span className="size-5 rounded-full bg-skeleton" />
                <span>{a.name}</span>
                <span className="text-caption text-ink-muted">{a.usedIn}화</span>
              </li>
            ))}
          </ul>
          {series.assets.length === 0 && (
            <p className="text-body-sm text-ink-muted">
              아직 고정한 에셋이 없어요. 에셋을 붙이면 회차마다 같은 얼굴로 그려져요.
            </p>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2.5 rounded-lg border border-dashed border-border-control p-5 lg:w-80">
          <h2 className="text-title font-semibold">성과</h2>
          <p className="text-body-sm text-ink-muted">
            인스타그램 계정을 연결하면 회차별 도달·저장·공유가 여기에 쌓여요. 오픈 베타 범위예요.
          </p>
          <div className="flex-1" />
          <Button variant="secondary" block disabled>
            인스타그램 연결
          </Button>
        </div>
      </section>
    </div>
  );
}
