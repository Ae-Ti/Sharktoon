"use client";

import { cn } from "@/lib/cn";

export interface ChoiceCardProps {
  title: string;
  /** 비우지 않는다. 기능 이름이 아니라 사용자가 얻는 결과로 쓴다. */
  description?: string;
  icon?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}

export function ChoiceCard({
  title,
  description,
  icon,
  selected,
  onClick,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1 rounded-xl text-left transition-all shadow-2xs",
        "bg-surface-card hover:border-brand/70 hover:shadow-xs",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        selected
          ? "border-2 border-brand bg-brand-tint/30 p-[15px] ring-1 ring-brand/20"
          : "border border-border/80 p-4",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          {icon && <span className="shrink-0 text-brand">{icon}</span>}
          <span className="text-body font-semibold text-ink">{title}</span>
        </span>
        {selected && (
          <span
            aria-hidden
            className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-on-brand shadow-2xs"
          >
            ✓
          </span>
        )}
      </span>
      {description && (
        <span className={cn("text-body-sm text-ink-muted", icon ? "pl-7" : undefined)}>{description}</span>
      )}
    </button>
  );
}
