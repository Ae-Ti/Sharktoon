import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";
import { getRepository, type EpisodeStatus } from "@/features/platform/data";
import { AttendanceBanner } from "@/features/platform/shell/AttendanceBanner";
import { NewSeriesButton } from "@/features/platform/series/NewSeriesButton";
import { BookOpen, Plus, Sparkles } from "lucide-react";
import { episodeCoverUrl, seriesCoverUrl } from "@/features/generation/data/covers";

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

  // 대표 이미지는 컷에서 고른다(최근 회차의 첫 컷). 컷이 없을 때만 저장된 썸네일(화풍 이미지)을 쓴다.
  const recent = series.slice(0, 3);
  const covers = await Promise.all(
    recent.map(async (s) => {
      const detail = await repo.getSeries(s.id);
      return (detail && (await seriesCoverUrl(detail.episodes))) ?? s.thumbUrl ?? null;
    }),
  );
  const resumableCover = resumable ? ((await episodeCoverUrl(resumable.episodeId)) ?? resumable.thumbUrl ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-title-lg font-bold">오늘도 한 화 올려볼까요?</h1>
        <ButtonLink
          href="/episodes/new"
          size="lg"
          variant="cta"
          className="group relative overflow-hidden h-12 px-6 text-body font-extrabold w-full sm:w-auto justify-center cta-button-float hover:-translate-y-1"
        >
          {/* Shimmer 광택 효과 레이어 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full"
          />
          <Plus className="size-5 shrink-0 stroke-[2.8] text-cyan-100 group-hover:rotate-90 transition-transform duration-500 ease-out relative z-10" />
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
            {resumableCover ? (
              <img
                src={resumableCover}
                alt={resumable.seriesTitle}
                className="size-14 shrink-0 rounded-lg object-cover border border-border/60 shadow-2xs"
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand shadow-2xs">
                <Sparkles className="size-6" />
              </div>
            )}
            <span className="flex flex-1 flex-col gap-1 min-w-0">
              <span className="text-body font-semibold truncate">
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
          <h2 className="text-title font-semibold">최근 작품</h2>
          {series.length > 3 && (
            <Link
              href="/series"
              className="text-caption font-semibold text-brand hover:underline"
            >
              전체 작품 ({series.length}) ↗
            </Link>
          )}
        </div>

        {series.length === 0 ? (
          <EmptyState
            title="아직 작품이 없어요"
            description="첫 화를 만들면 같은 캐릭터로 다음 화를 이어갈 수 있어요."
            actionLabel="첫 화 만들기"
            actionHref="/episodes/new"
          />
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {recent.map((s, i) => (
              <li key={s.id} className="flex">
                <Link
                  href={`/series/${s.id}`}
                  className="group flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface-card text-ink transition-all hover:border-brand/70 hover:shadow-xs"
                >
                  <div className="relative aspect-4/3 sm:aspect-square w-full overflow-hidden bg-surface-muted">
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
            ))}
            <li className="flex">
              <NewSeriesButton variant="card" />
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
