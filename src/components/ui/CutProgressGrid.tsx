"use client";

import { cn } from "@/lib/cn";
import { Button } from "./Button";
import type { CutStatus } from "@/contracts/generation";

export interface CutProgressItem {
  status: CutStatus;
  /** running 인 컷에만 준다. 대기 중 컷에 0% 막대를 그리면 멈춘 것처럼 보인다. */
  progress?: number;
}

export interface CutProgressGridProps {
  cuts: CutProgressItem[];
  title?: string;
  /** 실패한 컷이 있을 때만 노출된다. 실패한 컷만 큐에 다시 넣는다. */
  onRetry?: () => void;
}

const STATE: Record<CutStatus, { label: string; tile: string; text: string }> = {
  queued: { label: "대기", tile: "bg-skeleton border-border", text: "text-ink-subtle" },
  running: { label: "생성 중", tile: "bg-brand-tint border-brand", text: "text-brand-ink" },
  done: { label: "완료", tile: "bg-success-tint border-success-tint", text: "text-success" },
  failed: { label: "실패", tile: "bg-danger-tint border-danger", text: "text-danger" },
};

export function CutProgressGrid({
  cuts,
  title = "이미지 생성 중",
  onRetry,
}: CutProgressGridProps) {
  const done = cuts.filter((c) => c.status === "done").length;
  const failed = cuts.filter((c) => c.status === "failed").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-semibold">{title}</span>
        {/* 실패한 컷은 완료로 세지 않는다 */}
        <span className="text-caption tabular-nums text-ink-muted">
          {done} / {cuts.length}컷
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
        {cuts.map((cut, i) => {
          const s = STATE[cut.status];
          return (
            <div
              key={i}
              aria-label={`${i + 1}번 컷 ${s.label}`}
              className={cn(
                "relative grid aspect-square place-items-center overflow-hidden rounded-lg border",
                s.tile,
              )}
            >
              <span className="absolute top-1 left-2 text-[11px] font-bold text-ink-muted">
                {i + 1}
              </span>
              <span className={cn("text-caption font-semibold", s.text)}>
                {s.label}
              </span>
              {cut.status === "running" && (
                <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/8">
                  <span
                    className="block h-full bg-brand"
                    style={{ width: `${cut.progress ?? 0}%` }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-ink-muted">
          {failed > 0 ? (
            <>
              <strong className="font-semibold text-danger">
                {failed}개 컷을 못 만들었어요.
              </strong>{" "}
              쓴 크레딧은 돌려드렸어요.
            </>
          ) : (
            "먼저 끝난 컷부터 편집기에서 손볼 수 있어요."
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
