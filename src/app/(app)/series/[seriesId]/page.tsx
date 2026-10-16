import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, ButtonLink } from "@/components/ui";
import { getRepository } from "@/features/platform/data";
import { NewSeriesButton } from "@/features/platform/series/NewSeriesButton";
import { InstagramIntegrationCard } from "@/features/platform/instagram/InstagramIntegrationCard";
import { getSnsAnalyticsAction } from "@/features/platform/analytics/actions";
import { INITIAL_MOCK_SNS_DATA } from "@/features/platform/analytics/mockData";
import {
  getSeriesSnsMetrics,
  formatCompactNumber,
} from "@/features/platform/analytics/seriesAnalytics";
import type { EpisodeStatus } from "@/features/platform/data/types";
import { cn } from "@/lib/cn";
import { ImageIcon, Sparkles, Flame } from "lucide-react";

export const metadata: Metadata = { title: "작품 · 샥툰" };

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
  const [series, allSeries, snsRes, profile] = await Promise.all([
    repo.getSeries(seriesId),
    repo.listSeries(),
    getSnsAnalyticsAction(),
    repo.getProfile(),
  ]);
  if (!series) notFound();

  const snsData = snsRes.ok ? snsRes.data : INITIAL_MOCK_SNS_DATA;
  const snsSummary = getSeriesSnsMetrics(series, series.episodes, snsData);

  const next = Math.max(0, ...series.episodes.map((e) => e.number)) + 1;

  return (
    <div className="flex flex-col gap-6">
      {allSeries.length > 1 && (
        <nav aria-label="작품 전환" className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {allSeries.map((s) => {
              const active = s.id === series.id;
              return (
                <Link
                  key={s.id}
                  href={`/series/${s.id}`}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-caption font-semibold transition-all shrink-0",
                    active
                      ? "bg-brand text-on-brand shadow-2xs font-bold"
                      : "border border-border bg-surface-card text-ink-muted hover:border-brand/50 hover:text-ink",
                  )}
                >
                  <span>{s.title}</span>
                  <span className={cn("text-[11px]", active ? "text-white/80" : "text-ink-subtle")}>
                    {s.episodeCount}화
                  </span>
                </Link>
              );
            })}
          </div>
          <Link
            href="/series"
            className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-caption font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors shrink-0"
          >
            전체 작품 ({allSeries.length}) ↗
          </Link>
        </nav>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-title-lg font-bold">{series.title}</h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{series.rule.stylePreset}</Badge>
            <Badge>{series.rule.defaultCutCount}컷 기본</Badge>
            <Badge>{series.rule.aspectRatio}</Badge>
            {series.rule.tone && <Badge>{series.rule.tone}</Badge>}
            <Badge>소재 {series.assets.length}</Badge>
            {snsSummary.connected && snsSummary.totalReach > 0 && (
              <Badge tone="brand" className="font-semibold">
                인스타 누적 도달 {formatCompactNumber(snsSummary.totalReach)}
              </Badge>
            )}
          </div>
        </div>
        <NewSeriesButton
          seriesId={series.id}
          initialTitle={series.title}
          initialRule={series.rule}
          label="작품 스타일 설정"
        />
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-title font-semibold">회차</h2>
          {snsSummary.connected && (
            <span className="text-caption text-ink-muted">
              인스타그램 @{snsSummary.username} 성과 연동 중
            </span>
          )}
        </div>

        <ul className="flex gap-4 overflow-x-auto pb-1">
          {series.episodes.map((e) => {
            const metric = snsSummary.connected ? snsSummary.episodeMetrics[e.id] : null;
            const isTop = snsSummary.connected && snsSummary.topEpisode?.episodeId === e.id;

            return (
              <li key={e.id} className="w-45 shrink-0">
                <Link
                  href={`/episodes/${e.id}/editor`}
                  className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface-card text-ink hover:border-border-control transition-all"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-surface-muted">
                    {e.thumbUrl ? (
                      <img
                        src={e.thumbUrl}
                        alt={`${e.number}화`}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-1.5 text-ink-subtle">
                        <ImageIcon className="size-6 opacity-40" />
                        <span className="text-caption">
                          {e.status === "published" ? "대표 컷" : "작성 중"}
                        </span>
                      </div>
                    )}

                    {/* 인스타그램 성과 뱃지 (연동 + 발행된 회차) */}
                    {metric && (
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                        {isTop && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
                            <Flame className="size-2.5 fill-white text-white" />
                            인기 1위
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-xs backdrop-blur-xs tabular-nums">
                          <span>도달 {formatCompactNumber(metric.reach)}</span>
                          <span className="opacity-60">·</span>
                          <span>저장 {formatCompactNumber(metric.saves)}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <span className="flex flex-col gap-1.5 p-3">
                    <span className="text-body font-semibold truncate">
                      {e.number}화{e.title ? ` · ${e.title}` : ""}
                    </span>
                    <span className="flex items-center justify-between text-caption text-ink-muted">
                      <span>
                        {STATUS_LABEL[e.status]}
                        {formatDate(e.publishedAt) ? ` · ${formatDate(e.publishedAt)}` : ""}
                      </span>
                      {metric && (
                        <span className="text-[11px] font-semibold text-brand tabular-nums">
                          저장 {metric.saveRate}%
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}

          {/* 다음 화 제안 카드 */}
          <li className="flex w-64 shrink-0 flex-col gap-2.5 rounded-lg border border-brand bg-brand-tint p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <Badge tone="brand">
                {snsSummary.connected ? "✨ AI 성과 제안" : "다음 화 제안"}
              </Badge>
              {snsSummary.connected && (
                <span className="text-[10px] font-medium text-brand">
                  @{snsSummary.username}
                </span>
              )}
            </div>

            <p className="text-body-sm text-ink leading-relaxed">
              {snsSummary.connected && snsSummary.topEpisode ? (
                <>
                  지난 {snsSummary.topEpisode.episodeNumber}화(
                  {snsSummary.topEpisode.title})의 독자 저장율이{" "}
                  <strong>{snsSummary.topEpisode.saveRate}%</strong>로 가장 높았어요!
                  이 소재를 이어 <strong>{next}화</strong>를 시작해보세요.
                </>
              ) : (
                <>지난 회차에서 이어지는 소재로 {next}화를 시작할 수 있어요.</>
              )}
            </p>

            <div className="flex-1" />
            <ButtonLink href="/onboarding/story" size="sm" block>
              {next}화 시작하기
            </ButtonLink>
            <p className="text-[11px] leading-4 text-ink-muted">
              {snsSummary.connected
                ? "인스타그램 독자 반응 기반으로 최적화된 제안입니다."
                : "성과 기반 제안은 인스타 연동 후 정확해져요."}
            </p>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-surface-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-title font-semibold">에셋 참조</h2>
            <Link
              href={`/assets?series=${series.id}`}
              className="text-caption text-brand hover:underline font-medium"
            >
              에셋 라이브러리에서 관리 ↗
            </Link>
          </div>
          <p className="text-body-sm text-ink-muted">
            이 시리즈의 모든 회차에 아래 에셋이 고정 레퍼런스로 들어가요.
          </p>

          <ul className="flex flex-wrap gap-2.5">
            {series.assets.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-label"
              >
                {a.thumbUrl ? (
                  <img
                    src={a.thumbUrl}
                    alt={a.name}
                    className="size-5 rounded-full object-cover border border-border/60"
                  />
                ) : (
                  <span className="size-5 rounded-full bg-surface-muted" />
                )}
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

        <InstagramIntegrationCard
          series={series}
          episodes={series.episodes}
          initialSnsData={snsData}
          userPlan={profile?.plan ?? "free"}
        />
      </section>
    </div>
  );
}
