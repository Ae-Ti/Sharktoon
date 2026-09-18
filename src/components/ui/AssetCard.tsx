import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "./Badge";

export interface AssetCardProps {
  name: string;
  kind: string;
  /** 캐릭터만 brand 톤. 캐릭터가 일관성의 축이기 때문이다. */
  kindTone?: BadgeTone;
  /** 등록한 레퍼런스 이미지 그대로. 생성 결과물로 대신하지 않는다. */
  thumb?: ReactNode;
  /** 이 에셋을 참조하는 회차 수. 바꿨을 때 파급을 미리 보여준다. */
  usedIn?: number;
  onClick?: () => void;
}

export function AssetCard({
  name,
  kind,
  kindTone = "neutral",
  thumb,
  usedIn,
  onClick,
}: AssetCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-surface-card text-left hover:border-border-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="grid aspect-square place-items-center bg-surface-sunken text-caption text-ink-subtle">
        {thumb ?? "레퍼런스"}
      </span>
      <span className="flex flex-col gap-1 p-3">
        <span className="text-body font-semibold text-ink">{name}</span>
        <span className="flex items-center gap-2 text-caption text-ink-muted">
          <Badge tone={kindTone}>{kind}</Badge>
          {usedIn != null && <span>{usedIn}개 회차</span>}
        </span>
      </span>
    </button>
  );
}
