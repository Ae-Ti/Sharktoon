import type { PlanCardDetail, PlanFeatureCategory } from "./types";

export const PLAN_CARDS: PlanCardDetail[] = [
  {
    id: "free",
    name: "Free",
    tagline: "첫 화를 무료로 만들어 보세요",
    priceMonthly: 0,
    priceYearly: 0,
    billedYearlyTotal: 0,
    creditsMonthly: 0,
    estimatedEpisodes: "첫 화 1편 분량",
    popular: false,
    ctaLabel: "현재 이용 중",
    highlightPerks: ["Sharktoon 워터마크 표시"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "주 2~3회 연재하는 작가",
    badge: "가장 인기",
    badgeTone: "brand",
    priceMonthly: 19900,
    priceYearly: 15900,
    billedYearlyTotal: 190800,
    creditsMonthly: 120,
    estimatedEpisodes: "월 12~15편 분량",
    popular: true,
    ctaLabel: "Pro 플랜 시작하기",
    highlightPerks: [
      "워터마크 제거",
      "사진 한 장으로 나만의 화풍",
      "AI 독자 반응 피드백",
      "크레딧 추가 구매 10% 할인",
      "인스타 원클릭 발행·예약 (출시 예정)",
      "협찬 미디어킷 PDF (출시 예정)",
    ],
  },
  {
    id: "max",
    name: "Max",
    tagline: "매일 연재하거나 협찬툰을 많이 만드는 작가",
    priceMonthly: 49900,
    priceYearly: 39900,
    billedYearlyTotal: 478800,
    creditsMonthly: 350,
    estimatedEpisodes: "월 35~45편 분량",
    popular: false,
    ctaLabel: "Max 플랜 시작하기",
    highlightPerks: ["Pro의 모든 혜택", "크레딧 추가 구매 20% 할인"],
  },
];

export const FEATURE_CATEGORIES: PlanFeatureCategory[] = [
  {
    category: "크레딧 & 제작 스펙",
    items: [
      { name: "월 기본 지급 크레딧", free: "가입 시 8 C", pro: "120 C", max: "350 C", highlight: true },
      { name: "월 환산 제작 가능 분량", free: "1편 체험", pro: "약 12~15편", max: "약 35~45편" },
      { name: "크레딧 추가 충전 할인", free: "정가", pro: "10% 할인", max: "20% 추가 할인" },
    ],
  },
  {
    category: "화풍",
    items: [
      { name: "작품 화풍", free: "추천 화풍 6종", pro: "6종 + 나만의 화풍 (사진 업로드)", max: "6종 + 나만의 화풍 (사진 업로드)", highlight: true },
    ],
  },
  {
    category: "SNS 연재 & 비즈니스(수익화)",
    items: [
      { name: "Sharktoon 워터마크", free: "표시됨", pro: "완전 제거", max: "완전 제거", highlight: true },
      { name: "인스타그램 발행", free: "수동 다운로드 (외부 게시)", pro: "원클릭 발행 · 자동 예약 (출시 예정)", max: "원클릭 발행 · 자동 예약 (출시 예정)", highlight: true },
      { name: "AI 독자 반응 피드백 & 소재 추천", free: false, pro: "정밀 분석 & 맞춤 제안", max: "정밀 분석 & 맞춤 제안" },
      { name: "협찬 미디어킷", free: "기본 요약", pro: "PDF 다운로드 (출시 예정)", max: "PDF 다운로드 (출시 예정)" },
    ],
  },
];

export const PRICING_FAQS = [
  {
    question: "무료 플랜의 크레딧 지급 방식은 어떻게 되나요?",
    answer:
      "무료 플랜은 회원가입 시 8 크레딧(6컷 1회차 제작 + 2회 수정 분량)이 1회 제공됩니다. 별도의 월간 무료 리필은 제공되지 않으며, 매일 출석 체크를 통해 크레딧을 추가 적립하시거나 필요에 따라 Pro/Max 구독 또는 단품 팩을 충전하여 연재를 이어가실 수 있습니다.",
  },
  {
    question: "인스타그램 연동은 무료 플랜에서도 가능한가요?",
    answer:
      "무료 플랜에서도 계정을 연결하여 최근 도달 수와 저장 수 같은 기본 성과 요약을 확인하실 수 있습니다. 단, 원클릭 발행 · 자동 예약(출시 예정), AI 독자 반응 피드백, 협찬 미디어킷 PDF(출시 예정)는 Pro 및 Max 플랜에서 지원됩니다.",
  },
  {
    question: "남은 구독 크레딧은 다음 달로 이월되나요?",
    answer:
      "정기 구독으로 지급된 크레딧의 유효기간은 30일(해당 결제 주기)입니다. 미사용한 잔여 크레딧이 남아있더라도 매월 새 결제 주기에 맞춰 플랜별 기본 크레딧(120C/350C)이 새롭게 충전됩니다. 추가 구매하신 단품 크레딧은 5년간 유지됩니다.",
  },
  {
    question: "언제든 플랜을 변경하거나 해지할 수 있나요?",
    answer:
      "네, 약정 없이 언제든 마이페이지에서 자유롭게 플랜을 변경하거나 해지할 수 있습니다. 해지하시더라도 이미 결제된 이용 기간이 끝날 때까지는 프로 혜택이 그대로 유지됩니다.",
  },
];
