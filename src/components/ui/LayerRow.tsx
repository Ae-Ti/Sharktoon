"use client";

import { cn } from "@/lib/cn";

export interface LayerRowProps {
  name: string;
  /** 레이어 종류 약자: 배경 / 캐릭 / 말풍 / 텍스트 / 효과. */
  kindShort: string;
  /** 이미지에 굽지 않은 벡터 레이어. 말풍선·텍스트·나레이션·효과음에만 켠다. */
  vector?: boolean;
  selected?: boolean;
  hidden?: boolean;
  onSelect?: () => void;
  onToggle?: () => void;
}

export function LayerRow({
  name,
  kindShort,
  vector,
  selected,
  hidden,
  onSelect,
  onToggle,
}: LayerRowProps) {
  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex h-control-md cursor-pointer items-center gap-2 rounded-md px-2",
        selected ? "bg-brand-tint" : "hover:bg-surface-sunken",
      )}
    >
      <span aria-hidden className="cursor-grab text-label text-ink-subtle">
        ≡
      </span>
      <span
        className={cn(
          "grid size-6 place-items-center rounded-sm text-[11px] font-bold",
          selected
            ? "bg-surface-card text-brand-ink"
            : "bg-surface-sunken text-ink-muted",
        )}
      >
        {kindShort}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-label",
          hidden ? "text-ink-subtle line-through" : "text-ink",
        )}
      >
        {name}
      </span>
      {vector && (
        <span className="text-[11px] font-semibold text-ink-subtle">벡터</span>
      )}
      <button
        type="button"
        aria-label={hidden ? "레이어 보이기" : "레이어 숨기기"}
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
        className="grid size-control-sm cursor-pointer place-items-center rounded-sm text-label text-ink-muted hover:bg-surface-card hover:text-ink"
      >
        {hidden ? "✕" : "◉"}
      </button>
    </div>
  );
}
