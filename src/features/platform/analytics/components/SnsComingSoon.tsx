import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * 배포 환경에서 인스타 성과·연동·미디어킷 자리. 실제 연동(Instagram Login)과 앱 심사 전까지
 * 인증 없는 데모를 내보내지 않고 "출시 예정"만 보여준다. 목 모드에서는 쓰지 않는다(데모가 보인다).
 */
export function SnsComingSoon({
  title = "인스타그램 연동",
  description = "인스타그램 계정을 연결해 회차별 도달·저장 반응을 모아 보는 기능을 준비하고 있어요.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-xl border border-dashed border-border-control bg-surface-card/60 p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-surface-sunken text-ink-muted">
          <Clock className="size-4" />
        </span>
        <h2 className="text-title font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-muted">출시 예정</span>
      </div>
      <p className="text-body-sm text-ink-muted leading-relaxed">{description}</p>
    </div>
  );
}

/** 목 모드에서 예시 수치임을 밝히는 작은 배지. */
export function SnsDemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-warning-tint px-2 py-0.5 text-[10px] font-semibold text-warning",
        className,
      )}
      title="목 모드 예시 데이터예요. 실제 인스타그램 계정과 연결되지 않았어요."
    >
      예시 데이터
    </span>
  );
}
