import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";
import { getRepository, type EpisodeStatus } from "@/features/platform/data";
import { AttendanceBanner } from "@/features/platform/shell/AttendanceBanner";
import { NewSeriesButton } from "@/features/platform/series/NewSeriesButton";
import { Plus, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "홈 · 샥툰" };

/** 회차 상태 → 이어서 갈 곳. 크레딧을 쓰는 버튼은 그 화면 안에서 소모량을 밝힌다. */
const RESUME: Record<EpisodeStatus, { note: string; label: string; path: string }> = {
  draft: { note: "아직 사연만 적어 뒀어요", label: "콘티 만들기", path: "storyboard" },
  storyboard: { note: "콘티까지 만들어 뒀어요", label: "콘티 이어서", path: "storyboard" },
  generating: { note: "이미지를 만들고 있어요", label: "진행 보기", path: "generate" },
  ready: { note: "컷 생성이 완료되었어요. 대사와 말풍선을 편집해 보세요", label: "편집", path: "editor" },
  published: { note: "게시했어요", label: "보기", path: "publish" },
};

export default async function Page() {
  const repo = await getRepository();
  const [series, attendance, resumable, policy] = await Promise.all([
    repo.listSeries(),
    repo.getAttendance(),
    repo.getResumable(),
    repo.getCreditPolicy(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-title-lg font-bold">오늘도 한 화 올려볼까요?</h1>
        <ButtonLink
          href="/episodes/new"
          size="lg"
          variant="cta"
          className="group relative overflow-hidden h-12 px-6 text-body font-extrabold w-full sm:w-auto justify-center transition-[box-shadow,transform] duration-500 ease-out hover:-translate-y-0.5"
        >
          {/* Shimmer 광택 효과 레이어 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer-sweep"
          />
          <Plus className="size-5 shrink-0 stroke-[2.8] text-cyan-100 group-hover:rotate-90 transition-transform duration-300 relative z-10" />
          <span className="relative z-10 tracking-tight text-white drop-shadow-xs">새 인스타툰 만들기</span>
          <Sparkles className="size-4 shrink-0 text-cyan-200 animate-pulse relative z-10" />
        </ButtonLink>
      </div>

      <AttendanceBanner
        checkedInToday={attendance.checkedInToday}
        streak={attendance.streak}
        policy={policy}
      />

      {resumable && (
        <section className="flex flex-col gap-3">
          <h2 className="text-title font-semibold">이어서 만들기</h2>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-card p-4 shadow-2xs">
            <span className="size-14 shrink-0 rounded-lg bg-skeleton" />
            <span className="flex flex-1 flex-col gap-1">
              <span className="text-body font-semibold">
                {resumable.seriesTitle} · {resumable.number}화
              </span>
              <span className="text-caption text-ink-muted">{RESUME[resumable.status].note}</span>
            </span>
            <ButtonLink
              href={`/episodes/${resumable.episodeId}/${RESUME[resumable.status].path}`}
              size="md"
              variant="primary"
              className="h-11 px-6 font-bold shrink-0 shadow-xs"
            >
              {RESUME[resumable.status].label}
            </ButtonLink>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-title font-semibold">최근 시리즈</h2>
          {series.length > 3 && (
            <Link
              href="/series"
              className="text-caption font-semibold text-brand hover:underline"
            >
              전체 시리즈 ({series.length}) ↗
            </Link>
          )}
        </div>

        {series.length === 0 ? (
          <EmptyState
            title="아직 시리즈가 없어요"
            description="첫 화를 만들면 같은 캐릭터로 다음 화를 이어갈 수 있어요."
            actionLabel="첫 화 만들기"
            actionHref="/episodes/new"
          />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {series.slice(0, 3).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/series/${s.id}`}
                  className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-card text-ink hover:border-border-control"
                >
                  <span className="grid h-33 place-items-center bg-skeleton text-caption text-ink-subtle">
                    대표 컷
                  </span>
                  <span className="flex flex-col gap-1.5 p-3">
                    <span className="text-body font-semibold">{s.title}</span>
                    <span className="flex items-center gap-2 text-caption text-ink-muted">
                      {s.episodeCount}화
                      {!s.isPublic && <Badge>비공개</Badge>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <NewSeriesButton variant="card" />
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
