"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { CreditPill } from "@/components/ui";
import { cn } from "@/lib/cn";

export type GenerationStep = "storyboard" | "generate" | "editor" | "publish";

const STEPS: Array<{ key: GenerationStep; label: string; path: string }> = [
  { key: "storyboard", label: "콘티", path: "storyboard" },
  { key: "generate", label: "생성", path: "generate" },
  { key: "editor", label: "편집", path: "editor" },
  { key: "publish", label: "게시", path: "publish" },
];

export interface EpisodeHeaderProps {
  episodeId: string;
  seriesTitle: string;
  episodeTitle: string;
  current: GenerationStep;
  credits: number;
  /** 이 화면의 주 동작. 오른쪽 끝에 둔다. */
  action?: ReactNode;
  /** 모바일 화면(하단 고정 바가 있는 경우 등)에서 상단 헤더 액션을 숨김 */
  hideActionOnMobile?: boolean;
}

/**
 * 콘티 → 생성 → 편집을 한 회차 안의 이동으로 보이게 하는 헤더.
 * 모바일에서는 2열 구조(상단: 제목/크레딧, 하단: 4단계 세그먼트 탭)로 자동 전환되어 잘림을 방지한다.
 */
export function EpisodeHeader({
  episodeId,
  seriesTitle,
  episodeTitle,
  current,
  credits,
  action,
  hideActionOnMobile = false,
}: EpisodeHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-surface-card/95 backdrop-blur-md">
      {/* 1. 상단 메인 바 (모바일 & 데스크톱 공통) */}
      <div className="flex min-h-13 items-center justify-between gap-3 px-3.5 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
          <Link
            href="/home"
            title="홈으로"
            className="flex items-center gap-1 text-ink-muted hover:text-ink transition-colors md:hidden"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <Link
            href="/home"
            className="text-title font-extrabold tracking-[-0.03em] text-ink"
          >
            샥<span className="text-brand">툰</span>
          </Link>
          <span aria-hidden className="hidden text-ink-subtle md:inline">
            /
          </span>
          <span className="hidden truncate text-label text-ink-muted md:inline max-w-[120px]">
            {seriesTitle}
          </span>
          <span aria-hidden className="text-ink-subtle">
            /
          </span>
          <span className="truncate text-label font-semibold text-ink max-w-[140px] sm:max-w-xs">
            {episodeTitle}
          </span>
        </div>

        {/* 데스크톱 전용 인라인 스텝 내비게이션 (md 이상) */}
        <nav aria-label="제작 단계 (데스크톱)" className="hidden md:flex items-center gap-1 ml-4">
          {STEPS.map((step) => {
            const active = step.key === current;
            return (
              <Link
                key={step.key}
                href={`/episodes/${episodeId}/${step.path}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-control-sm items-center rounded-lg px-3 text-label font-medium transition-all",
                  active
                    ? "bg-brand-tint font-bold text-brand shadow-2xs"
                    : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                )}
              >
                {step.label}
              </Link>
            );
          })}
        </nav>

        {/* 우측 영역: 크레딧 + 데스크톱 주 동작 */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <CreditPill balance={credits} />
          {action && (
            <div className={cn("items-center gap-2", hideActionOnMobile ? "hidden lg:flex" : "hidden md:flex")}>
              {action}
            </div>
          )}
        </div>
      </div>

      {/* 2. 모바일 전용 4단계 세그먼트 탭 (md 미만) */}
      <div className="border-t border-border/50 px-3 py-1.5 md:hidden bg-surface-sunken/40">
        <nav aria-label="제작 단계 (모바일)" className="grid grid-cols-4 gap-1">
          {STEPS.map((step) => {
            const active = step.key === current;
            return (
              <Link
                key={step.key}
                href={`/episodes/${episodeId}/${step.path}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center justify-center rounded-md text-xs transition-all",
                  active
                    ? "bg-surface-card font-bold text-brand shadow-2xs ring-1 ring-border/50"
                    : "text-ink-muted hover:text-ink hover:bg-surface-sunken",
                )}
              >
                {step.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 3. 모바일 전용 액션 바 (action이 있고 모바일인 경우) */}
      {action && !hideActionOnMobile && (
        <div className="border-t border-border/60 bg-surface-card px-3 py-2 md:hidden">
          <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
            {action}
          </div>
        </div>
      )}
    </header>
  );
}
