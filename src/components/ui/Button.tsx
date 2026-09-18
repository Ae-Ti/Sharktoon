"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 가로 100%. 모바일 하단 고정 동작에 쓴다. */
  block?: boolean;
  loading?: boolean;
  /** 이 동작이 쓰는 크레딧. 값이 있으면 버튼 안에 "N크레딧"으로 표시한다. */
  cost?: number;
  children?: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover",
  secondary:
    "bg-surface-card text-ink border border-border-control hover:bg-surface-sunken",
  ghost: "text-brand-ink hover:bg-brand-tint",
  danger: "bg-danger text-on-signal",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-control-sm px-3 text-caption",
  md: "h-control-md px-5 text-label",
  lg: "h-control-lg px-6 text-body",
};

/** 크레딧 칩은 변형에 따라 배경이 다르다. 채워진 버튼 위에서는 흰 반투명. */
const COST: Record<ButtonVariant, string> = {
  primary: "bg-white/20",
  danger: "bg-white/20",
  secondary: "bg-accent-tint text-accent-ink",
  ghost: "bg-accent-tint text-accent-ink",
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  cost,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap",
        "cursor-pointer transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-45",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent opacity-85"
        />
      )}
      <span>{children}</span>
      {cost != null && !loading && (
        <span
          className={cn(
            "inline-flex h-[18px] items-center rounded-sm px-1 text-[11px] font-semibold",
            COST[variant],
          )}
        >
          {cost}크레딧
        </span>
      )}
    </button>
  );
}
