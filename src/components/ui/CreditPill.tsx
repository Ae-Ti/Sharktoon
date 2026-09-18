import { cn } from "@/lib/cn";

export interface CreditPillProps {
  balance: number;
  /** 최근 증감. 획득·소모·환불 직후에만 붙인다. */
  delta?: number;
  /** 이 값 이하면 경고 톤. 기본 3. */
  lowAt?: number;
}

export function CreditPill({ balance, delta, lowAt = 3 }: CreditPillProps) {
  const low = balance <= lowAt;
  return (
    <span
      title={low ? "크레딧이 얼마 남지 않았어요" : undefined}
      className={cn(
        "inline-flex h-control-sm items-center gap-2 rounded-full px-3",
        "text-label font-semibold tabular-nums",
        low ? "bg-warning-tint text-warning" : "bg-accent-tint text-accent-ink",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-[18px] place-items-center rounded-full text-[11px] font-bold text-on-signal",
          low ? "bg-warning" : "bg-accent",
        )}
      >
        C
      </span>
      <span>{balance}크레딧</span>
      {delta != null && delta !== 0 && (
        <span className="font-semibold opacity-85">
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
    </span>
  );
}
