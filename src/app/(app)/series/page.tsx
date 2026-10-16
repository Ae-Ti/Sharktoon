import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { getRepository, usingMockData } from "@/features/platform/data";
import { NewSeriesButton } from "@/features/platform/series/NewSeriesButton";
import { getSnsAnalyticsAction } from "@/features/platform/analytics/actions";
import { INITIAL_MOCK_SNS_DATA } from "@/features/platform/analytics/mockData";
import { formatCompactNumber } from "@/features/platform/analytics/seriesAnalytics";
import { seriesCoverUrl } from "@/features/generation/data/covers";

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
  // 홈의 최근 작품과 같은 대표 이미지: 최근 회차의 첫 컷, 없으면 저장된 썸네일(화풍 이미지).
  const covers = await Promise.all(
    allSeries.map(async (s) => {
      const detail = await repo.getSeries(s.id);
      return (detail && (await seriesCoverUrl(detail.episodes))) ?? s.thumbUrl ?? null;
    }),
  );

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

      {/* 연동 안내는 목 모드 데모에서만. 배포에서는 실제 연동 출시 전이라 띄우지 않는다 */}
      {!isConnected && usingMockData() && (
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
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {allSeries.map((s, i) => {
            const matchedEpisodes = isConnected
              ? (snsData.topEpisodes || []).filter((ep) => ep.seriesId === s.id || ep.seriesTitle === s.title)
              : [];
            const seriesReach = matchedEpisodes.reduce((sum, ep) => sum + (ep.reach || 0), 0);
            return (
              <li key={s.id} className="flex">
                <Link
                  href={`/series/${s.id}`}
                  className="group flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface-card text-ink transition-all hover:border-brand/70 hover:shadow-xs"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
                    {covers[i] ? (
                      <img
                        src={covers[i]!}
                        alt={s.title}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-brand-tint/20 text-brand">
                        <BookOpen className="size-6 text-brand/70" />
                        <span className="text-caption font-medium">연재 준비 중</span>
                      </div>
                    )}
                    {!s.isPublic && (
                      <span className="absolute top-2 right-2">
                        <Badge tone="neutral" className="text-[10px] px-1.5 py-0.5 bg-black/60 text-white backdrop-blur-xs border-0">
                          비공개
                        </Badge>
                      </span>
                    )}
                    {seriesReach > 0 && (
                      <span className="absolute top-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                        도달 {formatCompactNumber(seriesReach)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-3.5">
                    <span className="text-body font-bold text-ink line-clamp-1 group-hover:text-brand transition-colors">
                      {s.title}
                    </span>
                    <div className="mt-1 flex items-center justify-between text-caption text-ink-muted">
                      <span>{s.episodeCount}화 연재 중</span>
                      <span className="text-ink-subtle text-[11px]">
                        {new Date(s.updatedAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          <li className="flex">
            <NewSeriesButton variant="card" />
          </li>
        </ul>
      )}
    </div>
  );
}
