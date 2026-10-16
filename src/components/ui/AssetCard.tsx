import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "./Badge";
import { cn } from "@/lib/cn";

export interface AssetCardProps {
  name: string;
  kind: string;
  /** 캐릭터만 brand 톤. 캐릭터가 일관성의 축이기 때문이다. */
  kindTone?: BadgeTone;
  /** 등록한 레퍼런스 이미지 그대로. 생성 결과물로 대신하지 않는다. */
  thumb?: ReactNode;
  /** 이 에셋을 참조하는 회차 수. 바꿨을 때 파급을 미리 보여준다. */
  usedIn?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function AssetCard({
  name,
  kind,
  kindTone = "neutral",
  thumb,
  usedIn,
  selected = false,
  onClick,
}: AssetCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-surface-card text-left transition-all",
        selected
          ? "border-brand ring-2 ring-brand/40 shadow-xs"
          : "border-border/80 hover:border-border-control hover:shadow-2xs",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      )}
    >
      <span className="relative grid aspect-square w-full place-items-center overflow-hidden bg-gradient-to-br from-surface-sunken to-surface-card text-caption text-ink-subtle">
        {thumb ?? (
          <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center">
            <span className="text-2xl">
              {kind.includes("캐릭터") || kind.includes("인물") || kind.includes("동물")
                ? "🎨"
                : kind.includes("장소") || kind.includes("배경")
                ? "🏞️"
                : "✨"}
            </span>
            <span className="text-[11px] font-medium text-ink-muted">{name}</span>
          </div>
        )}
      </span>
      <span className="flex flex-col gap-1.5 p-3.5">
        <span className="text-body font-semibold text-ink group-hover:text-brand transition-colors line-clamp-1">
          {name}
        </span>
        <span className="flex items-center gap-2 text-caption text-ink-muted">
          <Badge tone={kindTone}>{kind}</Badge>
          {usedIn != null && <span>{usedIn}개 회차</span>}
        </span>
      </span>
    </button>
  );
}
