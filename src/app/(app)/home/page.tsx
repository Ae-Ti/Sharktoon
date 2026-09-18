import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";
import { getRepository } from "@/features/platform/data";
import { AttendanceBanner } from "@/features/platform/shell/AttendanceBanner";
import { NewSeriesButton } from "@/features/platform/series/NewSeriesButton";

export const metadata: Metadata = { title: "홈 · 샥툰" };

export default async function Page() {
  const repo = await getRepository();
  const [series, attendance, resumable] = await Promise.all([
    repo.listSeries(),
    repo.getAttendance(),
    repo.getResumable(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title-lg font-bold">오늘도 한 화 올려볼까요?</h1>

      <AttendanceBanner
        checkedInToday={attendance.checkedInToday}
        streak={attendance.streak}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-title font-semibold">내 시리즈</h2>

        {series.length === 0 ? (
          <EmptyState
            title="아직 시리즈가 없어요"
            description="첫 화를 만들면 같은 캐릭터로 다음 화를 이어갈 수 있어요."
            actionLabel="첫 화 만들기"
          />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {series.map((s) => (
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

      {resumable && (
        <section className="flex flex-col gap-3">
          <h2 className="text-title font-semibold">이어서 만들기</h2>
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-card px-4 py-3">
            <span className="size-14 shrink-0 rounded-md bg-skeleton" />
            <span className="flex flex-1 flex-col gap-1">
              <span className="text-body font-semibold">
                {resumable.seriesTitle} · {resumable.number}화
              </span>
              <span className="text-caption text-ink-muted">
                {resumable.status === "storyboard"
                  ? "콘티까지 만들어 뒀어요"
                  : resumable.status === "generating"
                    ? "이미지를 만들고 있어요"
                    : "아직 사연만 적어 뒀어요"}
              </span>
            </span>
            <Badge>초안</Badge>
            {/* 크레딧을 쓰는 이동이므로 소모량을 누르기 전에 밝힌다. */}
            <ButtonLink
              href={`/episodes/${resumable.episodeId}/${
                resumable.status === "draft" ? "storyboard" : "generate"
              }`}
              size="sm"
              cost={resumable.status === "draft" ? undefined : resumable.cutCount}
            >
              {resumable.status === "draft" ? "콘티 만들기" : "이미지 만들기"}
            </ButtonLink>
          </div>
        </section>
      )}
    </div>
  );
}
