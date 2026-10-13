import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";

export interface EmptyStateProps {
  /** 제목은 사실, 설명은 이득, 버튼은 행동. */
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-control bg-surface-sunken px-6 py-12 text-center">
      <p className="text-title font-semibold text-ink">{title}</p>
      {description && (
        <p className="max-w-[380px] text-body-sm text-ink-muted">{description}</p>
      )}
      {actionLabel &&
        (actionHref ? (
          <ButtonLink href={actionHref}>{actionLabel}</ButtonLink>
        ) : (
          <Button onClick={onAction}>{actionLabel}</Button>
        ))}
    </div>
  );
}
