import { Button } from "./Button";

export interface EmptyStateProps {
  /** 제목은 사실, 설명은 이득, 버튼은 행동. */
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-control bg-surface-sunken px-6 py-12 text-center">
      <p className="text-title font-semibold text-ink">{title}</p>
      {description && (
        <p className="max-w-[380px] text-body-sm text-ink-muted">{description}</p>
      )}
      {actionLabel && <Button onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}
