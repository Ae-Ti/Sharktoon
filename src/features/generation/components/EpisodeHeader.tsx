"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { CreditPill } from "@/components/ui";
import { cn } from "@/lib/cn";

export type GenerationStep = "storyboard" | "generate" | "editor" | "publish";

const STEPS: Array<{ key: GenerationStep; label: string; path: string }> = [
  { key: "storyboard", label: "콘티", path: "storyboard" },
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
  /** 콘티 단계 등에서 이미지 생성이 아직 진행되지 않아 편집/게시 진입이 불가능한지 여부 */
  hasGenerated?: boolean;
  /** 미완료 상태에서 비활성화된 단계를 클릭했을 때 호출되는 콜백 */
  onBlockedStepClick?: (step: GenerationStep) => void;
  /** 헤더 하단에 추가로 고정할 서브 네비게이션 또는 요소 (예: 콘티 1, 2단계 탭) */
  subHeader?: ReactNode;
}

/**
 * 콘티 → 편집 → 게시를 한 회차 안의 이동으로 보이게 하는 헤더.
 * 모바일에서는 2열 구조(상단: 제목/크레딧, 하단: 3단계 세그먼트 탭)로 자동 전환되어 잘림을 방지한다.
 */
export function EpisodeHeader({
  episodeId,
  seriesTitle,
  episodeTitle,
  current,
  credits,
  action,
  hideActionOnMobile = false,
  hasGenerated = true,
  onBlockedStepClick,
  subHeader,
}: EpisodeHeaderProps) {
  const isCurrentStep = (stepKey: GenerationStep) =>
    stepKey === current || (stepKey === "editor" && current === "generate");

  const isStepDisabled = (stepKey: GenerationStep) => {
    if (stepKey === "storyboard") return false;
    if (current === "storyboard" && !hasGenerated) return true;
    return false;
  };

  const handleBlockedClick = (stepKey: GenerationStep) => {
    onBlockedStepClick?.(stepKey);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-surface-card/95 backdrop-blur-md">
      {/* 1. 상단 메인 바 (모바일 & 데스크톱 공통) - 탭을 좌측 타이틀 바로 옆으로 정렬 */}
      <div className="flex min-h-13 items-center gap-3 px-3.5 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-1.5 md:gap-2 shrink-0">
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

        {/* 데스크톱 전용 인라인 스텝 내비게이션 (md 이상) - 왼쪽 타이틀 옆에 붙임 */}
        <nav aria-label="제작 단계 (데스크톱)" className="hidden md:flex items-center gap-1 ml-2">
          {STEPS.map((step) => {
            const active = isCurrentStep(step.key);
            const disabled = isStepDisabled(step.key);

            if (disabled) {
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => handleBlockedClick(step.key)}
                  title="콘티 단계에서 이미지 생성을 먼저 진행해 주세요"
                  className="flex h-control-sm items-center rounded-lg px-3.5 text-label font-medium text-ink-subtle opacity-40 hover:opacity-75 hover:bg-surface-sunken/60 cursor-pointer select-none transition-all"
                >
                  {step.label}
                </button>
              );
            }

            return (
              <Link
                key={step.key}
                href={`/episodes/${episodeId}/${step.path}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-control-sm items-center rounded-lg px-3.5 text-label font-medium transition-all",
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

        {/* 우측 영역: 크레딧 + 데스크톱 주 동작 (ml-auto로 우측 끝에 배치) */}
        <div className="ml-auto flex items-center gap-2 md:gap-3 shrink-0">
          <CreditPill balance={credits} />
          {action && (
            <div className={cn("items-center gap-2", hideActionOnMobile ? "hidden lg:flex" : "hidden md:flex")}>
              {action}
            </div>
          )}
        </div>
      </div>

      {/* 2. 모바일 전용 3단계 세그먼트 탭 (md 미만) */}
      <div className="border-t border-border/50 px-3 py-1.5 md:hidden bg-surface-sunken/40">
        <nav aria-label="제작 단계 (모바일)" className="grid grid-cols-3 gap-1.5">
          {STEPS.map((step) => {
            const active = isCurrentStep(step.key);
            const disabled = isStepDisabled(step.key);

            if (disabled) {
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => handleBlockedClick(step.key)}
                  title="콘티 단계에서 이미지 생성을 먼저 진행해 주세요"
                  className="flex h-8 items-center justify-center rounded-md text-xs text-ink-subtle opacity-40 hover:opacity-75 hover:bg-surface-sunken/60 cursor-pointer select-none transition-all"
                >
                  {step.label}
                </button>
              );
            }

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

      {/* 4. 서브 헤더 (콘티 1,2단계 등) */}
      {subHeader}
    </header>
  );
}
