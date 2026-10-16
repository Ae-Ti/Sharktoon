import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import { getRepository, usingMockData } from "@/features/platform/data";
import { SnsComingSoon } from "@/features/platform/analytics/components/SnsComingSoon";
import { NewSeriesButton } from "@/features/platform/series/NewSeriesButton";
import { InstagramIntegrationCard } from "@/features/platform/instagram/InstagramIntegrationCard";
import { getSnsAnalyticsAction } from "@/features/platform/analytics/actions";
import { INITIAL_MOCK_SNS_DATA } from "@/features/platform/analytics/mockData";
import {
  getSeriesSnsMetrics,
  formatCompactNumber,
} from "@/features/platform/analytics/seriesAnalytics";
import type { EpisodeStatus } from "@/features/platform/data/types";
import { ChevronLeft, ImageIcon, Flame, Plus } from "lucide-react";
import { withEpisodeCovers } from "@/features/generation/data/covers";

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
  const [series, snsRes, profile] = await Promise.all([
    repo.getSeries(seriesId),
    getSnsAnalyticsAction(),
    repo.getProfile(),
  ]);
  if (!series) notFound();

  const snsData = snsRes.ok ? snsRes.data : INITIAL_MOCK_SNS_DATA;
  const snsSummary = getSeriesSnsMetrics(series, series.episodes, snsData);

  const next = Math.max(0, ...series.episodes.map((e) => e.number)) + 1;
  // 회차 대표 이미지는 컷에서 고른다(실 저장소에는 썸네일 열이 없다).
  const episodes = await withEpisodeCovers(series.episodes);
  const isPaid = profile?.plan === "pro" || profile?.plan === "max";
  const aiSuggestion = isPaid && snsSummary.connected ? snsSummary.topEpisode : null;

  return (
    <div className="flex flex-col gap-6">
      {/* 작품 목록으로 돌아가기. 다른 작품 탭은 두지 않는다 */}
      <Link
        href="/series"
        className="inline-flex w-fit items-center gap-1 rounded-lg px-1 text-body-sm font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-4" />
        전체 작품
      </Link>

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
        <div className="flex items-center gap-2">
          <NewSeriesButton
            seriesId={series.id}
            initialTitle={series.title}
            initialRule={series.rule}
            label="작품 스타일 설정"
          />
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-title font-semibold">회차</h2>

        {aiSuggestion && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand-tint px-3.5 py-2.5 text-body-sm text-ink">
            <Badge tone="brand">✨ AI 성과 제안</Badge>
            지난 {aiSuggestion.episodeNumber}화({aiSuggestion.title})의 저장율이 <strong>{aiSuggestion.saveRate}%</strong>로 가장 높았어요. 이 소재를 이어 {next}화를 만들어 보세요.
          </p>
        )}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
          {episodes.map((e) => {
            const metric = snsSummary.connected ? snsSummary.episodeMetrics[e.id] : null;
            const isTop = snsSummary.connected && snsSummary.topEpisode?.episodeId === e.id;

            return (
              <li key={e.id}>
                <Link
                  href={`/episodes/${e.id}/editor`}
                  className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface-card text-ink hover:border-border-control transition-all"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
                    {e.thumbUrl ? (
                      <img
                        src={e.thumbUrl}
                        alt={`${e.number}화`}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-1.5 text-ink-subtle">
                        <ImageIcon className="size-6 opacity-40" />
                        <span className="text-caption">{e.status === "published" ? "컷 없음" : "작성 중"}</span>
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

                  <span className="flex flex-col gap-1 p-3">
                    <span className="text-body font-semibold truncate">
                      {e.number}화{e.title ? ` · ${e.title}` : ""}
                    </span>
                    <span className="flex items-center justify-between text-caption text-ink-muted">
                      <span>
                        {STATUS_LABEL[e.status]}
                        {formatDate(e.publishedAt) ? ` · ${formatDate(e.publishedAt)}` : ""}
                      </span>
                      {metric && (
                        <span className="text-[11px] font-semibold text-brand tabular-nums">저장 {metric.saveRate}%</span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}

          {/* 다음 화는 마지막 회차 옆 카드로. 열면 회차가 생기므로 미리 불러오지 않는다 */}
          <li>
            <Link
              href={`/episodes/new?seriesId=${series.id}`}
              prefetch={false}
              className="group flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-control/80 bg-surface-card/60 p-4 text-center transition-all hover:border-brand hover:bg-brand-tint/20"
            >
              <span className="grid size-10 place-items-center rounded-full bg-surface-muted text-ink-muted transition-colors group-hover:bg-brand group-hover:text-white">
                <Plus className="size-5 stroke-[2.6]" />
              </span>
              <span className="text-body-sm font-bold text-ink-muted group-hover:text-brand">{next}화 만들기</span>
              <span className="text-caption text-ink-subtle">화풍·소재가 그대로 이어져요</span>
            </Link>
          </li>
        </ul>
      </section>

      {/* 소재 | 인스타 연동 반반 */}
      {/* 두 패널 높이를 맞춘다(그리드 기본 stretch) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-title font-semibold">소재</h2>
            <Link href={`/assets?series=${series.id}`} className="text-caption text-brand hover:underline font-medium">
              소재 보관함에서 관리 ↗
            </Link>
          </div>
          <p className="text-body-sm text-ink-muted">이 작품의 모든 회차에 아래 소재가 고정 레퍼런스로 들어가요.</p>
          {series.assets.length > 0 ? (
            <ul className="flex flex-wrap gap-2.5">
              {series.assets.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-label">
                  {a.thumbUrl ? (
                    <img src={a.thumbUrl} alt={a.name} className="size-5 rounded-full object-cover border border-border/60" />
                  ) : (
                    <span className="size-5 rounded-full bg-surface-muted" />
                  )}
                  <span>{a.name}</span>
                  <span className="text-caption text-ink-muted">{a.usedIn}화</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-ink-muted">
              아직 고정한 소재가 없어요. 소재를 붙이면 회차마다 같은 얼굴로 그려져요.
            </p>
          )}
        </section>

        {/* 인증 없는 데모 연동은 목 모드에서만. 배포에서는 실제 연동 출시 전까지 "출시 예정" */}
        {usingMockData() ? (
          <InstagramIntegrationCard
            series={series}
            episodes={series.episodes}
            initialSnsData={snsData}
            userPlan={profile?.plan ?? "free"}
          />
        ) : (
          <SnsComingSoon
            title="인스타그램 성과"
            description="인스타그램을 연결하면 이 작품의 회차별 도달·저장 반응을 모아 보여줄 거예요. 준비하고 있어요."
          />
        )}
      </div>
    </div>
  );
}
