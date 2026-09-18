"use client";

import { Button, Modal } from "@/components/ui";
import { CREDIT_COST } from "@/contracts/credit";

export interface CreditSheetProps {
  open: boolean;
  onClose: () => void;
  /** 이 동작에 필요한 크레딧. credit_hold 가 SK001 로 거절한 금액. */
  required: number;
  available: number;
  /** 오늘 출석을 아직 안 했으면 여기서 바로 받게 한다. */
  canCheckIn?: boolean;
  onCheckIn?: () => void;
  onOpenPlans?: () => void;
}

/**
 * 크레딧이 모자랄 때 여는 시트.
 *
 * 버튼을 disabled 로 막지 않고 누르게 둔 뒤 이 시트를 여는 것이 규칙이다.
 * 왜 못 누르는지 모르는 상태가 부족하다는 사실보다 나쁘다.
 */
export function CreditSheet({
  open,
  onClose,
  required,
  available,
  canCheckIn,
  onCheckIn,
  onOpenPlans,
}: CreditSheetProps) {
  const short = Math.max(0, required - available);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="크레딧이 모자라요"
      description={`이 작업에 ${required}크레딧이 필요한데 ${available}크레딧 남았어요.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            나중에
          </Button>
          <Button onClick={onOpenPlans}>요금제 보기</Button>
        </>
      }
    >
      <div className="flex items-center justify-between gap-4 rounded-lg bg-accent-tint px-4 py-3">
        <span className="text-body-sm text-accent-ink">부족한 크레딧</span>
        <span className="text-title font-bold tabular-nums text-accent-ink">
          {short}
        </span>
      </div>

      {canCheckIn && (
        <button
          type="button"
          onClick={onCheckIn}
          className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border-control bg-surface-card px-4 py-3 text-left hover:bg-surface-sunken"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-body font-semibold">오늘 출석 크레딧 받기</span>
            <span className="text-body-sm text-ink-muted">
              하루 1크레딧, 7일 연속이면 3크레딧을 더 드려요.
            </span>
          </span>
          <span className="text-title font-bold text-accent-ink">+1</span>
        </button>
      )}

      <dl className="flex flex-col gap-1 text-body-sm text-ink-muted">
        <div className="flex justify-between gap-4">
          <dt>이미지 1컷</dt>
          <dd className="tabular-nums">{CREDIT_COST.cutImage}크레딧</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>부분 재생성</dt>
          <dd className="tabular-nums">{CREDIT_COST.partialRegenerate}크레딧</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>콘티·캡션 생성</dt>
          <dd>무료</dd>
        </div>
      </dl>
    </Modal>
  );
}
