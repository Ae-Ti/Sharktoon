import type { Metadata } from "next";
import Link from "next/link";
import { Plus, BookOpen, Layers, Sparkles, ArrowRight, TrendingUp } from "lucide-react";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";
import { getRepository } from "@/features/platform/data";
import { NewSeriesButton } from "@/features/platform/series/NewSeriesButton";
import { getSnsAnalyticsAction } from "@/features/platform/analytics/actions";
import { INITIAL_MOCK_SNS_DATA } from "@/features/platform/analytics/mockData";
import { formatCompactNumber } from "@/features/platform/analytics/seriesAnalytics";

export const metadata: Metadata = { title: "내 작품 · 샥툰" };

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export default async function Page() {
  const repo = await getRepository();
  const [allSeries, snsRes] = await Promise.all([
    repo.listSeries(),
    getSnsAnalyticsAction(),
  ]);
  const snsData = snsRes.ok ? snsRes.data : INITIAL_MOCK_SNS_DATA;
  const isConnected = Boolean(snsData.account?.connected);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-title-lg font-bold">내 작품</h1>
            {isConnected && (
              <Badge tone="brand" className="gap-1 text-[11px] font-semibold">
                <InstagramIcon className="size-3 text-pink-500" />
                <span>@{snsData.account.username}</span>
              </Badge>
            )}
          </div>
          <p className="text-body-sm text-ink-muted">
            고정된 캐릭터와 그림체로 연재 중인 인스타툰 작품 목록입니다.
          </p>
        </div>
        <NewSeriesButton label="새 작품 만들기" />
      </div>

      {!isConnected && (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border/80 bg-surface-card/60 p-4 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-pink-500/10 text-pink-600">
              <InstagramIcon className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-body-sm font-semibold text-ink">
                인스타그램 계정을 연동해 보세요
              </span>
              <span className="text-caption text-ink-muted">
                작품별 누적 도달, 게시물 저장 반응을 실시간으로 확인하고 다음 화 소재를 추천받을 수 있어요.
              </span>
            </div>
          </div>
          <Link
            href="/settings?tab=0"
            className="shrink-0 rounded-lg border border-pink-500/30 bg-surface-card px-3 py-1.5 text-caption font-bold text-pink-600 hover:bg-pink-50 hover:border-pink-500 transition-colors"
          >
            계정 연동하기 ↗
          </Link>
        </div>
      )}

      {allSeries.length === 0 ? (
        <EmptyState
          title="아직 생성된 작품이 없어요"
          description="새로운 작품을 만들고 일관된 캐릭터와 화풍으로 연재를 시작해 보세요."
          actionLabel="새 작품 시작하기"
          onAction={undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allSeries.map((s) => {
            // Find matched episodes for this series to show cumulative reach & saves
            const matchedEpisodes = isConnected
              ? (snsData.topEpisodes || []).filter(
                  (ep) => ep.seriesId === s.id || ep.seriesTitle === s.title
                )
              : [];
            const seriesReach = matchedEpisodes.reduce((sum, ep) => sum + (ep.reach || 0), 0);
            const seriesSaves = matchedEpisodes.reduce((sum, ep) => sum + (ep.saves || 0), 0);

            return (
              <Link
                key={s.id}
                href={`/series/${s.id}`}
                className="group flex flex-col justify-between rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs transition-all hover:border-brand/70 hover:shadow-xs cursor-pointer"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-brand-tint text-brand">
                      <BookOpen className="size-4" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {seriesReach > 0 && (
                        <span className="rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                          도달 {formatCompactNumber(seriesReach)}
                        </span>
                      )}
                      <Badge tone="brand">{s.episodeCount}화 연재 중</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-title font-semibold text-ink group-hover:text-brand transition-colors">
                      {s.title}
                    </h2>
                    {s.description && (
                      <p className="text-body-sm text-ink-muted line-clamp-2">
                        {s.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-caption text-ink-subtle pt-1">
                      <span>
                        최근 업데이트:{" "}
                        {new Date(s.updatedAt).toLocaleDateString("ko-KR", {
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      {seriesSaves > 0 && (
                        <span className="font-medium text-brand">
                          저장 {seriesSaves.toLocaleString()}회
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-caption font-semibold text-ink-muted group-hover:text-brand transition-colors">
                  <span>시리즈 관리하기</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
