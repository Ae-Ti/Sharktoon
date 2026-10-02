"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Field, Modal } from "@/components/ui";
import {
  cancelAccountDeletionAction,
  requestAccountDeletionAction,
  requestRefundAction,
} from "@/features/platform/actions";
import type {
  AccountStatus,
  CreditDetail,
  CreditPolicy,
  PlanTier,
  RefundQuote,
  RefundRequest,
} from "@/features/platform/data/types";

const PLAN_LABEL: Record<PlanTier, string> = { free: "무료", basic: "베이직", pro: "프로" };
const REFUND_LABEL: Record<RefundRequest["status"], string> = {
  requested: "처리 중",
  approved: "환불 승인",
  rejected: "반려",
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const day = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

export interface AccountSettingsProps {
  name: string | null;
  plan: PlanTier;
  credit: CreditDetail;
  policy: CreditPolicy;
  quote: RefundQuote;
  refund: RefundRequest | null;
  account: AccountStatus;
}

/**
 * 계정 설정 — 크레딧 내역, 환불, 탈퇴. 약관 제8조·제14조가 약속한 것을 화면으로 옮긴 것이다.
 * 탈퇴 전에 환불받을 수 있는 유료 크레딧을 먼저 보여준다(약관 제14조 제5항).
 */
export function AccountSettings({ name, plan, credit, policy, quote, refund, account }: AccountSettingsProps) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [askRefund, setAskRefund] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const openRefund = refund?.status === "requested";

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>, done?: () => void) {
    setNotice(null);
    start(async () => {
      const r = await action();
      if (r.ok) done?.();
      else setNotice(r.message);
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-title-lg font-bold">설정</h1>

      {notice && <p className="rounded-lg bg-danger-tint px-3 py-2 text-body-sm text-danger">{notice}</p>}

      {account.deletionRequestedAt && (
        <section className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-tint p-4">
          <p className="flex-1 text-body-sm text-danger">
            탈퇴를 요청했어요. {day(account.purgeAt!)}에 계정과 만든 작품이 모두 지워져요. 그 전에는 되돌릴 수 있어요.
          </p>
          <Button variant="secondary" loading={pending} onClick={() => run(cancelAccountDeletionAction)}>
            탈퇴 취소
          </Button>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-card p-5">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-title font-semibold">{name ?? "내 계정"}</h2>
          <Badge tone="brand">{PLAN_LABEL[plan]}</Badge>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label="무상" value={credit.byKind.free} />
          <Stat label="구독" value={credit.byKind.subscription} />
          <Stat label="구매" value={credit.byKind.purchase} />
        </dl>
        <p className="text-caption text-ink-muted">
          무상 → 구독 → 구매 순으로 써요.
          {credit.held > 0 && ` 지금 만드는 중인 컷에 ${credit.held}크레딧이 잡혀 있어요.`}
          {credit.nextExpiry &&
            ` ${day(credit.nextExpiry.at)}에 ${credit.nextExpiry.amount}크레딧이 사라져요.`}
        </p>
        <p className="text-caption text-ink-subtle">
          출석하면 하루 {policy.attendanceDaily}크레딧, {policy.attendanceStreakDays}일 연속이면{" "}
          {policy.attendanceStreakBonus}크레딧을 더 드려요. 출석 크레딧은 한 달에 {policy.attendanceMonthlyCap}크레딧까지예요.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-card p-5">
        <h2 className="text-title font-semibold">환불</h2>
        {refund && (
          <p className="text-body-sm text-ink-muted">
            최근 신청: {day(refund.createdAt)} · {won(refund.netKrw)} ·{" "}
            <Badge tone={refund.status === "rejected" ? "danger" : "neutral"}>{REFUND_LABEL[refund.status]}</Badge>
          </p>
        )}
        {quote.netKrw > 0 ? (
          <>
            <p className="text-body text-ink">
              쓰지 않은 유료 크레딧 {quote.credits}개 · {won(quote.grossKrw)}
              {quote.feeKrw > 0 && ` − 공제 ${won(quote.feeKrw)}`} ={" "}
              <strong className="font-semibold">{won(quote.netKrw)}</strong>
            </p>
            <p className="text-caption text-ink-muted">
              결제·환불 수수료로 {Math.round(policy.refundFeeRate * 100)}%를 빼요. 결제하고 7일 안에 한 번도 안 쓴 결제는 빼지 않아요.
              앱에서 산 크레딧은 각 스토어에서 환불해요.
            </p>
            <Button variant="secondary" disabled={openRefund} onClick={() => setAskRefund(true)}>
              {openRefund ? "환불 처리 중" : "환불 신청"}
            </Button>
          </>
        ) : (
          <p className="text-body-sm text-ink-muted">
            환불할 유료 크레딧이 없어요. 가입·출석으로 받은 무상 크레딧은 환불되지 않아요.
          </p>
        )}
      </section>

      {!account.deletionRequestedAt && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-card p-5">
          <h2 className="text-title font-semibold">탈퇴</h2>
          <p className="text-body-sm text-ink-muted">
            탈퇴하면 30일 뒤에 계정, 시리즈, 만든 작품이 모두 지워져요. 30일 안에는 되돌릴 수 있어요.
            무상 크레딧은 사라지고, 유료 크레딧은 탈퇴 전에 환불 신청을 해 주세요.
          </p>
          <Button variant="ghost" onClick={() => setAskDelete(true)}>
            탈퇴하기
          </Button>
        </section>
      )}

      <Modal
        open={askRefund}
        onClose={() => setAskRefund(false)}
        title={`${won(quote.netKrw)}을 환불할까요?`}
        description="신청하면 운영자가 확인한 뒤 결제를 취소해 돌려드려요. 환불한 크레딧은 바로 사라져요."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAskRefund(false)}>
              그대로 둘게요
            </Button>
            <Button
              loading={pending}
              onClick={() => run(() => requestRefundAction(reason.trim() || null), () => setAskRefund(false))}
            >
              환불 신청
            </Button>
          </>
        }
      >
        <Field label="이유(선택)" value={reason} onChange={setReason} maxLength={500} optional />
      </Modal>

      <Modal
        open={askDelete}
        onClose={() => setAskDelete(false)}
        title="정말 탈퇴할까요?"
        description={
          quote.netKrw > 0
            ? `환불받을 수 있는 유료 크레딧(${won(quote.netKrw)})이 있어요. 먼저 환불 신청을 하세요. 30일 뒤에는 모든 작품이 지워져요.`
            : "30일 뒤에 계정과 만든 작품이 모두 지워져요. 그 전에는 이 화면에서 되돌릴 수 있어요."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAskDelete(false)}>
              그대로 둘게요
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => run(requestAccountDeletionAction, () => setAskDelete(false))}
            >
              탈퇴하기
            </Button>
          </>
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-surface-sunken py-3">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="text-title font-bold tabular-nums">{value}</dd>
    </div>
  );
}
