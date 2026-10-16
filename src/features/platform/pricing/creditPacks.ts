import type { PlanTier } from "../data/types";

export interface CreditPack {
  id: string;
  name: string;
  nameKo: string;
  credits: number;
  priceKrw: number;
  originalPriceKrw?: number;
  discountBadge?: string;
  popular?: boolean;
  tagline: string;
  estimatedEpisodes: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "pack_starter",
    name: "Starter",
    nameKo: "스타터 팩",
    credits: 20,
    priceKrw: 4900,
    tagline: "급할 때 한두 화 더 연재하고 싶을 때",
    estimatedEpisodes: "약 2~3회차 제작 (6컷 기준)",
  },
  {
    id: "pack_standard",
    name: "Standard",
    nameKo: "스탠다드 팩",
    credits: 50,
    priceKrw: 9900,
    originalPriceKrw: 12250,
    discountBadge: "19% 할인",
    popular: true,
    tagline: "가장 많은 작가들이 선택하는 실속형 팩",
    estimatedEpisodes: "약 6~8회차 제작 (6컷 기준)",
  },
  {
    id: "pack_creator",
    name: "Creator",
    nameKo: "크리에이터 팩",
    credits: 120,
    priceKrw: 19900,
    originalPriceKrw: 29400,
    discountBadge: "32% 할인",
    tagline: "정기 연재 작가를 위한 대용량 가성비 팩",
    estimatedEpisodes: "약 15~20회차 제작",
  },
  {
    id: "pack_pro",
    name: "Pro Volume",
    nameKo: "프로 대용량 팩",
    credits: 300,
    priceKrw: 44900,
    originalPriceKrw: 73500,
    discountBadge: "39% 할인",
    tagline: "다작 연재 및 브랜드 협찬 광고툰 전문 작가용",
    estimatedEpisodes: "약 40~50회차 제작",
  },
];

/**
 * 플랜별 추가 할인율 계산
 * - Free: 정가 (0% 추가 할인)
 * - Pro: 10% 추가 할인
 * - Max: 20% 추가 할인
 */
export function getPackDiscountedPrice(
  pack: CreditPack,
  plan: PlanTier
): { finalPrice: number; planDiscountAmount: number; discountRate: number } {
  let rate = 0;
  if (plan === "pro") rate = 0.1;
  else if (plan === "max") rate = 0.2;

  const planDiscountAmount = Math.floor(pack.priceKrw * rate);
  const finalPrice = pack.priceKrw - planDiscountAmount;

  return { finalPrice, planDiscountAmount, discountRate: rate };
}

export type PaymentMethod = "kakaopay" | "tosspay" | "naverpay" | "card";

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; iconText: string; color: string }[] = [
  { id: "kakaopay", label: "카카오페이", iconText: "kakaopay", color: "bg-[#FEE500] text-[#191919]" },
  { id: "tosspay", label: "토스페이", iconText: "toss", color: "bg-[#0064FF] text-white" },
  { id: "naverpay", label: "네이버페이", iconText: "N pay", color: "bg-[#03C75A] text-white" },
  { id: "card", label: "신용/체크카드", iconText: "CARD", color: "bg-surface-sunken text-ink" },
];
