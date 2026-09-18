"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { SeriesFormModal } from "./SeriesFormModal";
import type { SeriesRule } from "@/features/platform/data/types";

export interface NewSeriesButtonProps {
  variant?: "card" | "button";
  seriesId?: string;
  initialTitle?: string;
  initialRule?: SeriesRule;
  label?: string;
}

/** 새 시리즈 만들기와 생성 규칙 수정이 같은 폼을 쓴다. */
export function NewSeriesButton({
  variant = "button",
  seriesId,
  initialTitle,
  initialRule,
  label,
}: NewSeriesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-full min-h-49 w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-border-control text-label font-semibold text-ink-muted hover:text-ink"
        >
          {label ?? "+ 새 시리즈"}
        </button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {label ?? "새 시리즈"}
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
