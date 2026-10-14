"use client";

import { cn } from "@/lib/cn";
import { Button } from "./Button";
import type { CutStatus } from "@/contracts/generation";

export interface CutProgressItem {
  /** 실패한 컷에 쓴 크레딧을 돌려줬는지. 크레딧을 잡기 전에 막힌 컷은 false 다. */
  refunded?: boolean;
  status: CutStatus;
  /** running 인 컷에만 준다. 대기 중 컷에 0% 막대를 그리면 멈춘 것처럼 보인다. */
  progress?: number;
  imageUrl?: string | null;
  cutId?: string;
  index?: number;
}

export interface CutProgressGridProps {
  cuts: CutProgressItem[];
  title?: string;
  aspectRatio?: "1:1" | "4:5";
  /** 실패한 컷이 있을 때만 노출된다. 실패한 컷만 큐에 다시 넣는다. */
  onRetry?: () => void;
  onCutClick?: (cut: CutProgressItem) => void;
}

const STATE: Record<CutStatus, { label: string; tile: string; text: string }> = {
  queued: { label: "대기", tile: "bg-surface-sunken/40 border-dashed border-border/80", text: "text-ink-subtle" },
  running: { label: "생성 중", tile: "bg-brand-tint/20 border-brand ring-2 ring-brand/30 shadow-2xs", text: "text-brand" },
  done: { label: "완료", tile: "bg-surface-card border-border/80", text: "text-ink" },
  failed: { label: "실패", tile: "bg-danger-tint/40 border-danger/60", text: "text-danger" },
};

export function CutProgressGrid({
  cuts,
  title = "이미지 생성 중",
  aspectRatio = "1:1",
  onRetry,
  onCutClick,
}: CutProgressGridProps) {
  const done = cuts.filter((c) => c.status === "done").length;
  const failed = cuts.filter((c) => c.status === "failed").length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-bold text-ink">{title}</span>
        {/* 실패한 컷은 완료로 세지 않는다 */}
        <span className="text-caption font-semibold tabular-nums text-ink-muted">
          {done} / {cuts.length}컷 완료
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
        {cuts.map((cut, i) => {
          const cutIdx = cut.index ?? i + 1;
          const isDone = cut.status === "done" && Boolean(cut.imageUrl);
          const isRunning = cut.status === "running";
          const isFailed = cut.status === "failed";
          const s = STATE[cut.status];

          return (
            <div
              key={cut.cutId ?? i}
              aria-label={`${cutIdx}번 컷 ${s.label}`}
              onClick={() => onCutClick?.(cut)}
              className={cn(
                "group relative overflow-hidden rounded-xl border transition-all",
                aspectRatio === "4:5" ? "aspect-[4/5]" : "aspect-square",
                s.tile,
                onCutClick && isDone ? "cursor-pointer hover:border-brand/80 hover:shadow-sm" : "",
              )}
            >
              {/* 이미지 렌더링 (완료 시 실제 생성 이미지) */}
              {isDone ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cut.imageUrl!}
                    alt={`${cutIdx}컷`}
                    className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  {onCutClick && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-caption font-semibold text-white opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
                      편집기에서 열기 ↗
                    </div>
                  )}
                </>
              ) : isRunning ? (
                <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center">
                  <span
                    aria-hidden
                    className="size-6 animate-spin rounded-full border-2 border-brand border-r-transparent"
                  />
                  <div className="flex flex-col items-center">
                    <span className="text-caption font-bold text-brand">생성 중</span>
                    <span className="text-[11px] font-semibold text-brand/80 tabular-nums">
                      {cut.progress ?? 0}%
                    </span>
                  </div>
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-brand-tint">
                    <span
                      className="block h-full bg-brand transition-all duration-300"
                      style={{ width: `${cut.progress ?? 0}%` }}
                    />
                  </span>
                </div>
              ) : isFailed ? (
                <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-danger">
                  <span className="text-caption font-bold">생성 실패</span>
                  <span className="text-[10px] text-danger/80">재시도 필요</span>
                </div>
              ) : (
                <div className="flex size-full items-center justify-center text-caption font-medium text-ink-subtle">
                  대기 중
                </div>
              )}

              {/* 컷 번호 뱃지 */}
              <span
                className={cn(
                  "absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold shadow-2xs tabular-nums",
                  isDone
                    ? "bg-black/60 text-white backdrop-blur-xs"
                    : isRunning
                      ? "bg-brand text-white"
                      : "bg-surface-card/90 text-ink-muted border border-border/80",
                )}
              >
                {cutIdx}컷
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-body-sm text-ink-muted">
          {failed > 0 ? (
            <>
              <strong className="font-semibold text-danger">
                {failed}개 컷을 못 만들었어요.
              </strong>{" "}
              {cuts.some((c) => c.status === "failed" && c.refunded)
                ? "쓴 크레딧은 돌려드렸어요."
                : "크레딧은 쓰지 않았어요."}
            </>
          ) : (
            "완료된 컷을 누르면 편집기에서 바로 대사와 말풍선을 편집할 수 있어요."
          )}
        </p>
        {failed > 0 && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            실패한 컷만 다시
          </Button>
        )}
      </div>
    </div>
  );
}
