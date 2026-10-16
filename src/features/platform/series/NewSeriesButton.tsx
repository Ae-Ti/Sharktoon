"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { SeriesFormModal } from "./SeriesFormModal";
import type { SeriesRule } from "@/features/platform/data/types";

export interface NewSeriesButtonProps {
  variant?: "card" | "button";
  seriesId?: string;
  initialTitle?: string;
  initialRule?: SeriesRule;
  label?: string;
  className?: string;
}

/** 새 시리즈 만들기와 생성 규칙 수정이 같은 폼을 쓴다. */
export function NewSeriesButton({
  variant = "button",
  seriesId,
  initialTitle,
  initialRule,
  label,
  className,
}: NewSeriesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            className ??
            "group flex h-full min-h-48 w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border-control/80 bg-surface-card/60 p-4 text-center transition-all hover:border-brand hover:bg-brand-tint/20"
          }
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-surface-muted text-ink-muted transition-colors group-hover:bg-brand group-hover:text-white shadow-2xs">
            <Plus className="size-5 stroke-[2.6]" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-body-sm font-bold text-ink-muted group-hover:text-brand transition-colors">
              {label ?? "새 작품 만들기"}
            </span>
            <span className="text-caption text-ink-subtle">
              새 캐릭터·화풍 설정
            </span>
          </div>
        </button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {label ?? "새 작품"}
        </Button>
      )}

      <SeriesFormModal
        open={open}
        onClose={() => setOpen(false)}
        seriesId={seriesId}
        initialTitle={initialTitle}
        initialRule={initialRule}
      />
    </>
  );
}
