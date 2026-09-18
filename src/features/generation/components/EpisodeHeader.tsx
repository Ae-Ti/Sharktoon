"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, CreditPill } from "@/components/ui";
import { cn } from "@/lib/cn";

export type GenerationStep = "storyboard" | "generate" | "editor";

const STEPS: Array<{ key: GenerationStep; label: string; path: string }> = [
  { key: "storyboard", label: "콘티", path: "storyboard" },
  { key: "generate", label: "생성", path: "generate" },
  { key: "editor", label: "편집", path: "editor" },
];

export interface EpisodeHeaderProps {
  episodeId: string;
  seriesTitle: string;
  episodeTitle: string;
  current: GenerationStep;
  credits: number;
  /** 이 화면의 주 동작. 오른쪽 끝에 둔다. */
  action?: ReactNode;
}

/**
 * 콘티 → 생성 → 편집을 한 회차 안의 이동으로 보이게 하는 헤더.
 * 세 화면이 각자 다른 머리를 달면 같은 회차를 다루는 중이라는 감각이 끊긴다.
 */
export function EpisodeHeader({
  episodeId,
  seriesTitle,
  episodeTitle,
  current,
  credits,
  action,
}: EpisodeHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface-card">
      <div className="flex h-14 items-center gap-4 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            className="text-title font-extrabold tracking-[-0.03em] text-ink"
          >
            샥툰
          </Link>
          <span aria-hidden className="text-ink-subtle">
            /
          </span>
          <span className="truncate text-label text-ink-muted">{seriesTitle}</span>
          <span aria-hidden className="text-ink-subtle">
            /
          </span>
          <span className="truncate text-label font-semibold text-ink">
            {episodeTitle}
          </span>
        </div>

        <nav aria-label="제작 단계" className="ml-2 flex items-center gap-1">
          {STEPS.map((step) => {
            const active = step.key === current;
            return (
              <Link
                key={step.key}
                href={`/episodes/${episodeId}/${step.path}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-control-sm items-center rounded-md px-3 text-label font-semibold",
                  active
                    ? "bg-brand-tint text-brand-ink"
                    : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                )}
              >
                {step.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Badge tone="ai">AI 생성</Badge>
          <CreditPill balance={credits} />
          {action}
        </div>
      </div>
    </header>
  );
}
