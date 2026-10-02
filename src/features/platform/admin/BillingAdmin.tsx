"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Field } from "@/components/ui";
import { grantPurchaseAction, processRefundAction } from "@/features/platform/actions";
import type { RefundRequest } from "@/features/platform/data/types";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/**
 * 운영자 결제 업무 — 환불 신청 처리와 수동 지급.
 * 결제대행사가 붙기 전에는 돈은 운영자가 직접 돌려주고(계좌이체·결제 취소), 여기서 원장을 맞춘다.
 */
export function BillingAdmin({ requests }: { requests: RefundRequest[] }) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [grant, setGrant] = useState({ userId: "", credits: "", amountKrw: "", note: "" });

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>, done?: string) {
    setNotice(null);
    start(async () => {
      const r = await action();
      setNotice(r.ok ? (done ?? null) : r.message);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface-card p-5">
      <h2 className="text-title font-semibold">환불 신청</h2>
      {notice && <p className="text-body-sm text-ink-muted">{notice}</p>}

      {requests.length === 0 ? (
        <p className="text-body-sm text-ink-muted">환불 신청이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-md bg-surface-sunken px-3 py-2">
              <span className="font-mono text-caption">{r.userId}</span>
              <span className="text-body-sm tabular-nums">
                {r.credits}크레딧 · {won(r.netKrw)}
                {r.feeKrw > 0 && ` (공제 ${won(r.feeKrw)})`}
              </span>
              {r.reason && <span className="text-caption text-ink-muted">“{r.reason}”</span>}
              <span className="ml-auto flex items-center gap-2">
                {r.status === "requested" ? (
                  <>
                    <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => processRefundAction(r.id, false, null), "반려했어요")}>
                      반려
                    </Button>
                    <Button
                      size="sm"
                      loading={pending}
                      onClick={() => run(() => processRefundAction(r.id, true, null), "승인했어요. 결제 취소(또는 이체)를 진행하세요.")}
                    >
                      승인
                    </Button>
                  </>
                ) : (
                  <Badge tone={r.status === "approved" ? "success" : "neutral"}>
                    {r.status === "approved" ? "승인" : "반려"}
                  </Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="h-px bg-border" />

      <h3 className="text-label font-semibold">수동 지급</h3>
      <p className="text-caption text-ink-muted">
        베타 테스터 지급이나 계좌이체 결제. 결제 금액을 적으면 환불 단가가 된다. 0원이면 환불되지 않는 크레딧이다.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="사용자 id" value={grant.userId} onChange={(v) => setGrant({ ...grant, userId: v.trim() })} />
        <Field label="크레딧" value={grant.credits} onChange={(v) => setGrant({ ...grant, credits: v })} />
        <Field label="결제 금액(원)" value={grant.amountKrw} onChange={(v) => setGrant({ ...grant, amountKrw: v })} />
        <Field label="메모" value={grant.note} onChange={(v) => setGrant({ ...grant, note: v })} optional />
      </div>
      <Button
        variant="secondary"
        loading={pending}
        onClick={() =>
          run(
            () =>
              grantPurchaseAction({
                userId: grant.userId,
                credits: Number(grant.credits),
                amountKrw: Number(grant.amountKrw || 0),
                note: grant.note || null,
              }),
            "지급했어요",
          )
        }
      >
        지급
      </Button>
    </section>
  );
}
