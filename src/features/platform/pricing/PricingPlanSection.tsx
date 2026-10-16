"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Minus,
  Sparkles,
  Crown,
  Zap,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Coins,
  ArrowRight,
} from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { updatePlanAction } from "@/features/platform/actions";
import type { PlanTier } from "@/features/platform/data/types";
import { PLAN_CARDS, FEATURE_CATEGORIES, PRICING_FAQS } from "./constants";
import type { BillingCycle, PlanCardDetail } from "./types";
import { CREDIT_PACKS, getPackDiscountedPrice } from "./creditPacks";
import { CreditPurchaseModal } from "./CreditPurchaseModal";

function won(num: number): string {
  return `₩${num.toLocaleString("ko-KR")}`;
}

export interface PricingPlanSectionProps {
  currentPlan: PlanTier;
  creditBalance: number;
  onPlanChange?: (newPlan: PlanTier) => void;
}

export function PricingPlanSection({
  currentPlan,
  creditBalance,
  onPlanChange,
}: PricingPlanSectionProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [selectedPlanModal, setSelectedPlanModal] = useState<PlanCardDetail | null>(null);
  const [activePlan, setActivePlan] = useState<PlanTier>(currentPlan);
  const [openCreditModal, setOpenCreditModal] = useState(false);
  const [selectedCreditPackId, setSelectedCreditPackId] = useState<string>("pack_standard");
  const [userCreditBalance, setUserCreditBalance] = useState<number>(creditBalance);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showFullTable, setShowFullTable] = useState(true);

  const handleSelectPlan = (plan: PlanCardDetail) => {
    if (plan.id === activePlan) return;
    setSelectedPlanModal(plan);
  };

  const handleConfirmSubscription = () => {
    if (!selectedPlanModal) return;
    const targetPlan = selectedPlanModal.id;

    start(async () => {
      const res = await updatePlanAction(targetPlan);
      if (res.ok) {
        setActivePlan(targetPlan);
        onPlanChange?.(targetPlan);
        setSelectedPlanModal(null);
        setNotice(
          `🎉 ${selectedPlanModal.name} 플랜 구독이 시작되었습니다!`
        );
        setTimeout(() => setNotice(null), 5000);
      } else {
        setNotice(res.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand-tint px-4 py-3 text-body-sm font-semibold text-brand shadow-2xs">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* 1. 헤더 & 결제 주기 토글 */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-tint/80 px-3 py-1 text-caption font-bold text-brand shadow-2xs">
          <Sparkles className="size-3.5" />
          <span>크리에이터를 위한 맞춤형 플랜</span>
        </div>
        <div className="space-y-1.5">
          <h2 className="text-title-lg font-extrabold text-ink sm:text-2xl">
            나만의 연재 속도에 맞춰 시작하세요
          </h2>
          <p className="max-w-xl text-body-sm text-ink-muted">
            워터마크 없는 고해상도 웹툰, 레이어 분리 편집, AI 독자 피드백과 협찬 미디어킷으로 연재 수익을 만드세요.
          </p>
        </div>

        {/* 결제 주기 토글 Switch */}
        <div className="mt-2 inline-flex items-center rounded-xl border border-border/80 bg-surface-sunken/60 p-1 shadow-inner">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "rounded-lg px-4 py-2 text-caption font-bold transition-all cursor-pointer",
              billingCycle === "monthly"
                ? "bg-surface-card text-ink shadow-2xs"
                : "text-ink-muted hover:text-ink"
            )}
          >
            월간 결제
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-caption font-bold transition-all cursor-pointer",
              billingCycle === "yearly"
                ? "bg-brand text-on-brand shadow-2xs"
                : "text-ink-muted hover:text-ink"
            )}
          >
            <span>연간 결제</span>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-extrabold",
                billingCycle === "yearly"
                  ? "bg-white/20 text-white"
                  : "bg-brand/15 text-brand"
              )}
            >
              20% 할인 🎁
            </span>
          </button>
        </div>
      </div>

      {/* 2. 현재 내 구독 상태 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface-card p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-tint text-brand shadow-2xs">
            {activePlan === "max" ? (
              <Crown className="size-5 text-amber-500" />
            ) : activePlan === "pro" ? (
              <Zap className="size-5 text-brand" />
            ) : (
              <ShieldCheck className="size-5 text-ink-muted" />
            )}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-bold text-ink">
                현재 플랜: {activePlan === "max" ? "Max" : activePlan === "pro" ? "Pro" : "Free"}
              </span>
              <Badge tone={activePlan === "free" ? "neutral" : "brand"} className="text-[10px] font-bold">
                이용 중
              </Badge>
            </div>
            <p className="text-caption text-ink-muted">
              보유 잔여 크레딧: <strong className="font-bold text-brand">{creditBalance} C</strong>
              {activePlan === "free" && " · Pro 업그레이드 시 매월 120C와 워터마크 제거가 즉시 적용됩니다."}
              {activePlan === "pro" && " · 매월 120C 정기 충전 및 모든 프로 혜택이 적용 중입니다."}
              {activePlan === "max" && " · 매월 350C 정기 충전 및 모든 맥스 혜택이 적용 중입니다."}
            </p>
          </div>
        </div>
      </div>

      {/* 3. 3단 요금제 카드 그리드 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 items-stretch">
        {PLAN_CARDS.map((card) => {
          const isCurrent = activePlan === card.id;
          const displayPrice =
            card.id === "free"
              ? 0
              : billingCycle === "yearly"
              ? card.priceYearly
              : card.priceMonthly;

          return (
            <div
              key={card.id}
              className={cn(
                "relative flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition-all shadow-xs",
                card.popular
                  ? "border-brand bg-gradient-to-b from-brand-subtle/30 via-surface-card to-surface-card ring-2 ring-brand/30 shadow-md"
                  : card.id === "max"
                  ? "border-purple-500/50 bg-gradient-to-b from-purple-500/10 via-surface-card to-surface-card shadow-sm"
                  : "border-border/80 bg-surface-card hover:border-border"
              )}
            >
              {/* 상단 뱃지 */}
              {card.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-caption font-extrabold shadow-sm",
                      card.id === "pro"
                        ? "bg-brand text-on-brand"
                        : "bg-gradient-to-r from-amber-500 to-purple-600 text-white"
                    )}
                  >
                    {card.badge}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {/* 플랜 헤더 */}
                <div>
                  <h3 className="text-title font-extrabold text-ink sm:text-title-lg">
                    {card.name}
                  </h3>
                  <p className="mt-1 text-caption text-ink-muted leading-tight">
                    {card.tagline}
                  </p>
                </div>

                {/* 가격 정보 */}
                <div className="rounded-xl border border-border/60 bg-surface-sunken/40 p-3.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-ink tabular-nums sm:text-3xl">
                      {displayPrice === 0 ? "무료" : won(displayPrice)}
                    </span>
                    {displayPrice > 0 && (
                      <span className="text-caption font-semibold text-ink-muted">
                        / 월
                      </span>
                    )}
                  </div>
                  {card.id !== "free" && billingCycle === "yearly" && (
                    <p className="mt-1 text-[11px] font-medium text-brand">
                      연 {won(card.billedYearlyTotal)} 일괄 결제 (2개월분 무료)
                    </p>
                  )}
                  {card.id !== "free" && billingCycle === "monthly" && (
                    <p className="mt-1 text-[11px] text-ink-subtle">
                      언제든 위약금 없이 해지 가능
                    </p>
                  )}
                  {card.id === "free" && (
                    <p className="mt-1 text-[11px] text-ink-subtle">
                      신용카드 등록 없이 즉시 시작
                    </p>
                  )}
                </div>

                {/* 제공 크레딧 요약 박스 */}
                <div className="flex items-center gap-2 rounded-lg bg-surface-sunken/70 px-3 py-2 text-caption">
                  <Coins className="size-4 shrink-0 text-amber-500" />
                  <div className="flex flex-col">
                    <span className="font-bold text-ink">
                      {card.id === "free" ? "가입 시 8 C 1회 지급" : `매월 ${card.creditsMonthly} C 정기 지급`}
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      {card.estimatedEpisodes}
                    </span>
                  </div>
                </div>

                {/* 혜택 리스트 */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                    주요 포함 혜택
                  </span>
                  <ul className="flex flex-col gap-2 text-caption text-ink">
                    {card.highlightPerks.map((perk, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="size-3.5 shrink-0 text-brand mt-0.5" />
                        <span className={cn(i === 0 || i === 1 ? "font-bold text-ink" : "text-ink-muted")}>
                          {perk}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 하단 CTA 버튼 */}
              <div className="pt-6">
                {isCurrent ? (
                  <Button
                    variant="secondary"
                    size="md"
                    disabled
                    className="w-full font-bold opacity-80 cursor-default"
                  >
                    현재 이용 중인 플랜
                  </Button>
                ) : (
                  <Button
                    variant={card.id === "pro" ? "primary" : card.id === "max" ? "primary" : "secondary"}
                    size="md"
                    onClick={() => handleSelectPlan(card)}
                    className={cn(
                      "w-full font-bold shadow-xs",
                      card.id === "max" &&
                        "bg-gradient-to-r from-purple-600 to-brand hover:brightness-110 text-white"
                    )}
                  >
                    <span>{card.ctaLabel}</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. 상세 기능 비교표 (Feature Comparison Table) */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" />
            <h3 className="text-body font-bold text-ink sm:text-title">
              플랜별 기능 한눈에 비교하기
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowFullTable(!showFullTable)}
            className="inline-flex items-center gap-1 text-caption font-bold text-brand hover:underline cursor-pointer"
          >
            <span>{showFullTable ? "비교표 접기" : "비교표 펼치기"}</span>
            {showFullTable ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>

        {showFullTable && (
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left text-caption border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b border-border/80 text-ink-muted">
                  <th className="py-3 px-3 font-bold w-2/5">기능 및 혜택</th>
                  <th className="py-3 px-3 font-bold text-center w-1/5">Free</th>
                  <th className="py-3 px-3 font-bold text-center w-1/5 text-brand bg-brand-tint/30 rounded-t-lg">
                    Pro (추천)
                  </th>
                  <th className="py-3 px-3 font-bold text-center w-1/5 text-purple-700 dark:text-purple-400">
                    Max
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {FEATURE_CATEGORIES.map((cat, catIdx) => (
                  <>
                    <tr key={`cat-${catIdx}`} className="bg-surface-sunken/40">
                      <td colSpan={4} className="py-2.5 px-3 font-extrabold text-[11px] text-ink-subtle uppercase">
                        {cat.category}
                      </td>
                    </tr>
                    {cat.items.map((item, itemIdx) => (
                      <tr key={`item-${catIdx}-${itemIdx}`} className="hover:bg-surface-sunken/20 transition-colors">
                        <td className="py-3 px-3 font-medium text-ink">
                          <span className={cn(item.highlight && "font-bold text-brand")}>
                            {item.name}
                          </span>
                        </td>
                        {/* Free */}
                        <td className="py-3 px-3 text-center text-ink-muted">
                          {typeof item.free === "boolean" ? (
                            item.free ? (
                              <Check className="size-4 text-emerald-600 mx-auto" />
                            ) : (
                              <Minus className="size-4 text-ink-subtle mx-auto opacity-40" />
                            )
                          ) : (
                            item.free
                          )}
                        </td>
                        {/* Pro */}
                        <td className="py-3 px-3 text-center font-semibold text-brand bg-brand-tint/15">
                          {typeof item.pro === "boolean" ? (
                            item.pro ? (
                              <Check className="size-4 text-brand mx-auto font-bold" />
                            ) : (
                              <Minus className="size-4 text-ink-subtle mx-auto opacity-40" />
                            )
                          ) : (
                            item.pro
                          )}
                        </td>
                        {/* Max */}
                        <td className="py-3 px-3 text-center font-bold text-purple-700 dark:text-purple-300">
                          {typeof item.max === "boolean" ? (
                            item.max ? (
                              <Check className="size-4 text-purple-600 mx-auto font-bold" />
                            ) : (
                              <Minus className="size-4 text-ink-subtle mx-auto opacity-40" />
                            )
                          ) : (
                            item.max
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4.5. 크레딧 단품 팩 구매 (구독 없이 필요한 만큼 충전) */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent-tint text-accent">
              <Coins className="size-5" />
            </div>
            <div>
              <h3 className="text-body font-bold text-ink sm:text-title">
                구독 없이 필요한 만큼만! 크레딧 단품 팩
              </h3>
              <p className="text-caption text-ink-muted">
                정기 결제 부담 없이 충전하고, 5년간 소멸 걱정 없이 자유롭게 쓰세요.
              </p>
            </div>
          </div>
          {activePlan !== "free" && (
            <Badge tone="brand" className="text-caption font-bold">
              ✨ {activePlan.toUpperCase()} 구독 혜택 {activePlan === "max" ? "20%" : "10%"} 추가 할인 적용
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {CREDIT_PACKS.map((pack) => {
            const { finalPrice, planDiscountAmount } = getPackDiscountedPrice(pack, activePlan);
            const unitPrice = Math.round(finalPrice / pack.credits);

            return (
              <div
                key={pack.id}
                className={cn(
                  "relative flex flex-col justify-between p-4 rounded-xl border transition-all",
                  pack.popular
                    ? "border-brand/80 bg-brand-tint/10 shadow-2xs"
                    : "border-border/80 bg-surface-sunken/30 hover:border-border-control"
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

                <div className="flex flex-col gap-1">
                  <span className="text-caption font-bold text-ink-muted">{pack.nameKo}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-title-lg font-extrabold text-ink tabular-nums">
                      +{pack.credits}
                    </span>
                    <span className="text-body-sm font-semibold text-brand">C</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-body font-bold text-ink tabular-nums">{won(finalPrice)}</span>
                    {planDiscountAmount > 0 && (
                      <span className="text-[11px] text-ink-subtle line-through tabular-nums">
                        {won(pack.priceKrw)}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-ink-subtle">1C당 {won(unitPrice)}</span>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setSelectedCreditPackId(pack.id);
                    setOpenCreditModal(true);
                  }}
                  className="mt-4 w-full h-8 text-caption font-semibold"
                >
                  충전하기
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. FAQ (자주 묻는 질문) */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-4 text-ink-muted" />
          <h3 className="text-body font-bold text-ink sm:text-title">
            자주 묻는 질문
          </h3>
        </div>

        <div className="flex flex-col divide-y divide-border/60">
          {PRICING_FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={index} className="py-3.5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="flex w-full items-center justify-between text-left text-body-sm font-semibold text-ink hover:text-brand transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  {isOpen ? (
                    <ChevronUp className="size-4 shrink-0 text-ink-muted" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-ink-muted" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-2 text-caption text-ink-muted leading-relaxed pl-1">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. 구독 및 플랜 변경 확인 모달 */}
      <Modal
        open={Boolean(selectedPlanModal)}
        onClose={() => setSelectedPlanModal(null)}
        title={`${selectedPlanModal?.name} 플랜 시작`}
        description={
          selectedPlanModal?.id === "free"
            ? "무료 플랜으로 다운그레이드하시겠어요? 다음 결제 주기부터 무료 크레딧이 적용됩니다."
            : `첫 7일 동안 무료로 체험하고, 이후 ${
                billingCycle === "yearly"
                  ? `${won(selectedPlanModal?.priceYearly || 0)}/월 (연간 결제)`
                  : `${won(selectedPlanModal?.priceMonthly || 0)}/월`
              }로 결제됩니다. 언제든 위약금 없이 해지 가능합니다.`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelectedPlanModal(null)}>
              취소
            </Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={handleConfirmSubscription}
              className={cn(
                "font-bold",
                selectedPlanModal?.id === "max" &&
                  "bg-gradient-to-r from-purple-600 to-brand text-white"
              )}
            >
              {selectedPlanModal?.id === "free"
                ? "무료 플랜으로 변경"
                : `${selectedPlanModal?.name} 플랜 시작하기`}
            </Button>
          </>
        }
      >
        {selectedPlanModal && (
          <div className="flex flex-col gap-3.5 pt-1">
            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-sunken/40 p-4">
              <div className="flex flex-col">
                <span className="text-caption font-semibold text-brand">
                  {billingCycle === "yearly" ? "연간 결제 플랜 (20% 할인)" : "월간 결제 플랜"}
                </span>
                <span className="text-title font-extrabold text-ink">
                  {selectedPlanModal.name} 멤버십
                </span>
              </div>
              <div className="text-right">
                <span className="text-title font-extrabold text-ink">
                  {selectedPlanModal.id === "free"
                    ? "무료"
                    : won(
                        billingCycle === "yearly"
                          ? selectedPlanModal.priceYearly
                          : selectedPlanModal.priceMonthly
                      )}
                </span>
                {selectedPlanModal.id !== "free" && (
                  <span className="text-caption text-ink-muted"> / 월</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5 rounded-xl bg-surface-sunken/60 p-3.5 text-caption text-ink-muted">
              <div className="flex items-center gap-1.5 font-bold text-ink">
                <Check className="size-4 text-brand" />
                <span>
                  {selectedPlanModal.id === "free"
                    ? "가입 시 8 크레딧 1회 지급"
                    : `매월 ${selectedPlanModal.creditsMonthly} 크레딧 즉시 지급`}
                </span>
              </div>
              {selectedPlanModal.id !== "free" && (
                <div className="flex items-center gap-1.5 text-ink-muted">
                  <Check className="size-4 text-brand" />
                  <span>워터마크 완전 제거</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-ink-muted">
                <Check className="size-4 text-brand" />
                <span>언제든 마이페이지에서 자유롭게 해지 및 환불 정책 적용</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <CreditPurchaseModal
        open={openCreditModal}
        onClose={() => setOpenCreditModal(false)}
        currentPlan={activePlan}
        currentBalance={userCreditBalance}
        defaultPackId={selectedCreditPackId}
        onPurchaseSuccess={(added, newTotal) => {
          setUserCreditBalance(newTotal);
          setNotice(`🎉 ${added} 크레딧 충전이 완료되었습니다! (총 잔량: ${newTotal}C)`);
          setTimeout(() => setNotice(null), 5000);
        }}
      />
    </div>
  );
}

