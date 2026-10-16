"use client";

import { useState, useTransition } from "react";
import {
  Coins,
  Check,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { PlanTier } from "../data/types";
import {
  CREDIT_PACKS,
  PAYMENT_METHODS,
  getPackDiscountedPrice,
  type CreditPack,
  type PaymentMethod,
} from "./creditPacks";
import { purchaseCreditPackAction } from "../actions";

function won(num: number): string {
  return `₩${num.toLocaleString("ko-KR")}`;
}

export interface CreditPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan?: PlanTier;
  currentBalance?: number;
  defaultPackId?: string;
  onPurchaseSuccess?: (credits: number, newBalance: number) => void;
}

export function CreditPurchaseModal({
  open,
  onClose,
  currentPlan = "free",
  currentBalance = 0,
  defaultPackId = "pack_standard",
  onPurchaseSuccess,
}: CreditPurchaseModalProps) {
  const [selectedPackId, setSelectedPackId] = useState<string>(defaultPackId);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("kakaopay");
  const [pending, start] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ credits: number; newBalance: number } | null>(null);

  const selectedPack = CREDIT_PACKS.find((p) => p.id === selectedPackId) ?? CREDIT_PACKS[1];
  const { finalPrice, planDiscountAmount, discountRate } = getPackDiscountedPrice(
    selectedPack,
    currentPlan
  );

  const handlePurchase = () => {
    setErrorMsg(null);
    start(async () => {
      const res = await purchaseCreditPackAction(selectedPack.id);
      if (res.ok) {
        setSuccessInfo({ credits: res.credits, newBalance: res.newBalance });
        onPurchaseSuccess?.(res.credits, res.newBalance);
      } else {
        setErrorMsg(res.message);
      }
    });
  };

  const handleResetAndClose = () => {
    setSuccessInfo(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleResetAndClose}
      title={successInfo ? "결제 완료" : "크레딧 충전"}
      description={
        successInfo
          ? "크레딧이 계정에 즉시 지급되었습니다."
          : "구독 플랜과 무관하게 필요한 만큼 충전하고 5년간 자유롭게 사용하세요."
      }
      footer={
        successInfo ? (
          <Button onClick={handleResetAndClose} className="w-full sm:w-auto">
            확인
          </Button>
        ) : (
          <div className="flex w-full flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button variant="secondary" onClick={handleResetAndClose} disabled={pending}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handlePurchase}
              loading={pending}
              className="gap-2 font-bold px-6 shadow-xs"
            >
              <span>{won(finalPrice)} 결제하고 즉시 충전</span>
              <Coins className="size-4" />
            </Button>
          </div>
        )
      }
    >
      {successInfo ? (
        <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2 className="size-10 stroke-[2.2]" />
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-title-lg font-bold text-ink">
              +{successInfo.credits} 크레딧 충전 완료!
            </h4>
            <p className="text-body-sm text-ink-muted">
              현재 보유 잔량은{" "}
              <strong className="text-brand font-bold">{successInfo.newBalance}C</strong>입니다.
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-surface-sunken/50 p-4 text-caption text-ink-muted w-full space-y-1 text-left">
            <p className="font-semibold text-ink">충전 상세 안내</p>
            <p>• 충전된 크레딧의 유효기간은 5년(2031년까지)입니다.</p>
            <p>• 컷 이미지 생성 시 무상 → 구독 → 구매 크레딧 순서로 안전하게 차감됩니다.</p>
            <p>• 마이페이지의 '사용 내역'에서 언제든 결제 및 사용 기록을 확인하실 수 있습니다.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-tint px-3.5 py-2.5 text-body-sm text-danger">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 현재 보유 잔량 & 플랜 혜택 안내 바 */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface-sunken/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-brand" />
              <span className="text-body-sm text-ink">
                현재 보유: <strong>{currentBalance} C</strong>
              </span>
            </div>
            {discountRate > 0 && (
              <Badge tone="brand" className="text-[11px] font-bold">
                <Sparkles className="size-3 mr-1" />
                {currentPlan.toUpperCase()} 플랜 {discountRate * 100}% 추가 할인 적용 중
              </Badge>
            )}
          </div>

          {/* 크레딧 팩 선택 카드 그리드 */}
          <div className="flex flex-col gap-2">
            <label className="text-label font-bold text-ink">충전 크레딧 선택</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CREDIT_PACKS.map((pack) => {
                const isSelected = selectedPackId === pack.id;
                const { finalPrice: packPrice } = getPackDiscountedPrice(pack, currentPlan);
                const unitPrice = Math.round(packPrice / pack.credits);

                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setSelectedPackId(pack.id)}
                    className={cn(
                      "relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer",
                      isSelected
                        ? "border-brand bg-brand-tint/15 shadow-2xs"
                        : "border-border/80 bg-surface-card hover:border-border-control"
                    )}
                  >
                    {pack.popular && (
                      <span className="absolute -top-2.5 right-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                        인기 ⚡
                      </span>
                    )}
                    {pack.discountBadge && !pack.popular && (
                      <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                        {pack.discountBadge}
                      </span>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-body font-bold text-ink">{pack.nameKo}</span>
                      <div
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full border transition-colors",
                          isSelected
                            ? "border-brand bg-brand text-white"
                            : "border-border-control bg-surface-card"
                        )}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-title-lg font-extrabold text-ink tabular-nums">
                        +{pack.credits}
                      </span>
                      <span className="text-body-sm font-semibold text-brand">C</span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-caption">
                      <span className="font-extrabold text-ink tabular-nums">{won(packPrice)}</span>
                      <span className="text-ink-subtle">컷당 {won(unitPrice)}</span>
                    </div>

                    <p className="mt-2 text-[11px] text-ink-muted border-t border-border/50 pt-1.5">
                      {pack.estimatedEpisodes}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 결제 수단 선택 */}
          <div className="flex flex-col gap-2">
            <label className="text-label font-bold text-ink">결제 수단</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((method) => {
                const isSelected = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-caption font-semibold transition-all cursor-pointer",
                      isSelected
                        ? "border-brand bg-brand-tint/30 text-brand ring-1 ring-brand font-bold"
                        : "border-border/80 bg-surface-card text-ink-muted hover:border-border-control hover:text-ink"
                    )}
                  >
                    <span>{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 결제 요약 */}
          <div className="rounded-xl border border-border/80 bg-surface-sunken/40 p-4 space-y-2">
            <div className="flex items-center justify-between text-body-sm text-ink-muted">
              <span>상품 금액 ({selectedPack.nameKo})</span>
              <span className="tabular-nums">{won(selectedPack.priceKrw)}</span>
            </div>
            {planDiscountAmount > 0 && (
              <div className="flex items-center justify-between text-body-sm font-semibold text-brand">
                <span>{currentPlan.toUpperCase()} 플랜 할인 ({discountRate * 100}%)</span>
                <span className="tabular-nums">-{won(planDiscountAmount)}</span>
              </div>
            )}
            <div className="border-t border-border/60 pt-2 flex items-center justify-between text-body font-bold text-ink">
              <span>최종 결제 금액 (VAT 포함)</span>
              <span className="text-title font-extrabold text-brand tabular-nums">
                {won(finalPrice)}
              </span>
            </div>
          </div>

          {/* 안심 보장 배너 */}
          <div className="flex items-start gap-2 text-caption text-ink-subtle">
            <ShieldCheck className="size-4 shrink-0 text-brand/70 mt-0.5" />
            <p>
              충전된 크레딧은 <strong>5년간 유효</strong>하며, 미사용분은 전자상거래법 및 약관 제14조에 따라
              수수료 10% 공제 후 환불받으실 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
