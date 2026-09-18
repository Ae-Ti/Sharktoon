import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "ai";

export interface BadgeProps {
  tone?: BadgeTone;
  /** 상태가 바뀌는 뱃지에 켠다. 색 말고 형태로도 구분되게. */
  dot?: boolean;
  children?: ReactNode;
}

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-ink-muted",
  brand: "bg-brand-tint text-brand-ink",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  ai: "bg-surface-sunken text-ink-muted border border-border",
};

export function Badge({ tone = "neutral", dot, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1 rounded-sm px-2 text-caption font-semibold",
        TONE[tone],
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
