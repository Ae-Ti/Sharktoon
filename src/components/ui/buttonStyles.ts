import { cn } from "@/lib/cn";

/**
 * Button 과 ButtonLink 가 함께 쓰는 클래스.
 * 서버 컴포넌트에서도 불러야 하므로 "use client" 를 붙이지 않는다.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover",
  secondary:
    "bg-surface-card text-ink border border-border-control hover:bg-surface-sunken",
  ghost: "text-brand-ink hover:bg-brand-tint",
  danger: "bg-danger text-on-signal",
};

export const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-control-sm px-3 text-caption",
  md: "h-control-md px-5 text-label",
  lg: "h-control-lg px-6 text-body",
};

/** 크레딧 칩은 변형에 따라 배경이 다르다. 채워진 버튼 위에서는 흰 반투명. */
export const BUTTON_COST: Record<ButtonVariant, string> = {
  primary: "bg-white/20",
  danger: "bg-white/20",
  secondary: "bg-accent-tint text-accent-ink",
  ghost: "bg-accent-tint text-accent-ink",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  block,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap",
    "cursor-pointer transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "disabled:cursor-not-allowed disabled:opacity-45",
    BUTTON_VARIANT[variant],
    BUTTON_SIZE[size],
    block && "w-full",
    className,
  );
}
