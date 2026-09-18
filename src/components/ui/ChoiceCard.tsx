"use client";

import { cn } from "@/lib/cn";

export interface ChoiceCardProps {
  title: string;
  /** 비우지 않는다. 기능 이름이 아니라 사용자가 얻는 결과로 쓴다. */
  description?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function ChoiceCard({
  title,
  description,
  selected,
  onClick,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1 rounded-lg text-left transition-colors",
        "bg-surface-card hover:border-brand",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        // 선택 시 테두리가 2px 로 두꺼워지지만 안쪽 여백을 1px 줄여 카드 크기를 유지한다
        selected
          ? "border-2 border-brand bg-brand-tint p-[15px]"
          : "border border-border-control p-4",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-body font-semibold text-ink">{title}</span>
        {selected && (
          <span
            aria-hidden
            className="grid size-5 place-items-center rounded-full bg-brand text-caption font-bold text-on-brand"
          >
            ✓
          </span>
        )}
      </span>
      {description && (
        <span className="text-body-sm text-ink-muted">{description}</span>
      )}
    </button>
  );
}
