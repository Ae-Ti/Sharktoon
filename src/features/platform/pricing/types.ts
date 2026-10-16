export type BillingCycle = "monthly" | "yearly";

export interface PlanFeatureItem {
  name: string;
  free: string | boolean;
  pro: string | boolean;
  max: string | boolean;
  highlight?: boolean;
}

export interface PlanFeatureCategory {
  category: string;
  items: PlanFeatureItem[];
}

export interface PlanCardDetail {
  id: "free" | "pro" | "max";
  name: string;
  nameKo: string;
  tagline: string;
  badge?: string;
  badgeTone?: "brand" | "neutral" | "warning";
  priceMonthly: number;
  priceYearly: number; // 월 환산 금액
  billedYearlyTotal: number;
  creditsMonthly: number;
  estimatedEpisodes: string;
  highlightPerks: string[];
  ctaLabel: string;
  popular?: boolean;
}

