import type { Metadata } from "next";
import Link from "next/link";
import { Plus, BookOpen, Layers, Sparkles, ArrowRight } from "lucide-react";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";
import { getRepository } from "@/features/platform/data";
import { NewSeriesButton } from "@/features/platform/series/NewSeriesButton";

export const metadata: Metadata = { title: "내 시리즈 · 샥툰" };

export default async function Page() {
  const repo = await getRepository();
  const allSeries = await repo.listSeries();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-title-lg font-bold">내 시리즈</h1>
          <p className="text-body-sm text-ink-muted">
            고정된 캐릭터와 그림체로 연재 중인 인스타툰 시리즈 목록입니다.
          </p>
        </div>
        <NewSeriesButton label="새 시리즈 만들기" />
      </div>

      {allSeries.length === 0 ? (
        <EmptyState
          title="아직 생성된 시리즈가 없어요"
          description="새로운 시리즈를 만들고 일관된 캐릭터와 화풍으로 연재를 시작해 보세요."
          actionLabel="새 시리즈 시작하기"
          onAction={undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allSeries.map((s) => (
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
                  <Badge tone="brand">{s.episodeCount}화 연재 중</Badge>
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
                  <p className="text-caption text-ink-subtle pt-1">
                    최근 업데이트: {new Date(s.updatedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-caption font-semibold text-ink-muted group-hover:text-brand transition-colors">
                <span>시리즈 관리하기</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
