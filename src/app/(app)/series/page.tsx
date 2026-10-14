import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui";
import { getRepository } from "@/features/platform/data";
import { NewSeriesButton } from "@/features/platform/series/NewSeriesButton";

export const metadata: Metadata = { title: "시리즈 목록 · 샥툰" };

export default async function Page() {
  const repo = await getRepository();
  const series = await repo.listSeries();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-title-lg font-bold">내 시리즈 ({series.length})</h1>
          <p className="text-body-sm text-ink-muted">
            캐릭터와 생성 규칙을 고정해 회차를 이어가는 만화 묶음이에요.
          </p>
        </div>
        <NewSeriesButton label="+ 새 시리즈 만들기" />
      </header>

      {series.length === 0 ? (
        <EmptyState
          title="아직 시리즈가 없어요"
          description="첫 화를 만들면 같은 캐릭터로 다음 화를 이어갈 수 있어요."
          actionLabel="첫 화 만들기 (온보딩)"
          actionHref="/onboarding/character"
        />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {series.map((s) => (
            <li key={s.id}>
              <Link
                href={`/series/${s.id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface-card text-ink transition-all hover:border-brand/60 hover:shadow-sm"
              >
                <div className="grid h-36 place-items-center bg-surface-sunken text-caption text-ink-subtle group-hover:bg-brand-tint/20 transition-colors">
                  <span className="font-medium text-ink-muted">대표 컷 미리보기</span>
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-body font-bold text-ink group-hover:text-brand transition-colors">
                      {s.title}
                    </span>
                    {!s.isPublic && <Badge tone="neutral">비공개</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-caption text-ink-muted">
                    <span className="font-semibold text-ink">{s.episodeCount}화 발행</span>
                    <span>·</span>
                    <span className="text-[11px] text-ink-subtle">
                      {new Date(s.updatedAt).toLocaleDateString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                      })} 수정
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
          <li>
            <NewSeriesButton variant="card" />
          </li>
        </ul>
      )}
    </div>
  );
}
