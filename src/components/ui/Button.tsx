"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  BUTTON_COST,
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "./buttonStyles";

export type { ButtonVariant, ButtonSize };

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
      className={buttonClasses({ variant, size, block, className })}
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
            BUTTON_COST[variant],
          )}
        >
          {cost}크레딧
        </span>
      )}
    </button>
  );
}
