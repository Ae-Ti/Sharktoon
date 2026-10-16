import type { PlanCardDetail, PlanFeatureCategory } from "./types";

export const PLAN_CARDS: PlanCardDetail[] = [
  {
    id: "free",
    name: "Free",
    nameKo: "무료 체험",
    tagline: "8 크레딧으로 1회차를 온보딩 제작해보는 무료 체험 플랜",
    priceMonthly: 0,
    priceYearly: 0,
    billedYearlyTotal: 0,
    creditsMonthly: 0,
    estimatedEpisodes: "가입 시 1편 체험 (월 무료 리필 없음)",
    popular: false,
    ctaLabel: "현재 이용 중",
    highlightPerks: [
      "가입 시 8 크레딧 1회 지급 (월 무료 리필 없음)",
      "출석 체크로 크레딧 추가 적립 (월 상한 없음)",
      "최대 4컷 회차 제작 지원",
      "고품질 flare/sunburst 모델 체험",
      "고정 에셋(캐릭터/소품) 최대 3개",
      "Sharktoon 워터마크 표시",
      "비상업적 개인 용도 한정",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    nameKo: "프로 작가",
    tagline: "주 2~3회 정기 연재로 팬덤과 수익을 키우는 작가",
    badge: "가장 인기 ✨",
    badgeTone: "brand",
    priceMonthly: 19900,
    priceYearly: 15900,
    billedYearlyTotal: 190800,
    creditsMonthly: 120,
    estimatedEpisodes: "월 12~15편 (주 2~3회 연재 충분)",
    popular: true,
    ctaLabel: "Pro 플랜 시작하기",
    highlightPerks: [
      "매월 120 크레딧 정기 지급 (flare/sunburst 모델)",
      "워터마크 완전 제거 & 상업적 이용 가능",
      "최대 8컷 캐러셀 회차 제작",
      "전체 화풍 12종 + 스타일 커스텀 프리셋",
      "고정 캐릭터/소품/배경 최대 20개",
      "배경/인물/말풍선 4중 레이어 분리 에디터",
      "AI 독자 반응 피드백 & 다음 화 추천",
      "실시간 협찬 미디어킷 (웹 링크 & PDF 다운로드)",
      "인스타그램 자동 예약 발행 스케줄러",
      "크레딧 추가 충전 10% 할인",
    ],
  },
  {
    id: "max",
    name: "Max",
    nameKo: "맥스 전업",
    tagline: "다작 연재, 브랜드 협찬 광고툰 전문 작가 및 에이전시",
    badge: "프로 전업 👑",
    badgeTone: "warning",
    priceMonthly: 49900,
    priceYearly: 39900,
    billedYearlyTotal: 478800,
    creditsMonthly: 350,
    estimatedEpisodes: "월 35~45편 (매일 연재 및 브랜드 협찬)",
    popular: false,
    ctaLabel: "Max 플랜 시작하기",
    highlightPerks: [
      "매월 350 크레딧 + 추가 단품 구매 20% 할인",
      "Pro의 모든 혜택 포함 (인스타 즉시/예약 발행, 미디어킷)",
      "나만의 그림체 커스텀 LoRA 학습 / 스타일 복제",
      "고정 에셋 및 회차 컷수 무제한",
      "4K Ultra HD 초고해상도 + Turbo 전용 큐 (대기 0초)",
      "포토샵/클립스튜디오 원본 레이어 (PSD/PNG) 다운로드",
      "브랜드 광고주 협찬 매칭 풀 우선 노출 뱃지",
    ],
  },
];

export const FEATURE_CATEGORIES: PlanFeatureCategory[] = [
  {
    category: "크레딧 & 제작 스펙",
    items: [
      { name: "월 기본 지급 크레딧", free: "가입 시 8 C (월 리필 0C)", pro: "120 C", max: "350 C", highlight: true },
      { name: "월 환산 제작 가능 분량", free: "1편 체험", pro: "약 12~15편", max: "약 35~45편" },
      { name: "AI 생성 엔진 (배포 모델)", free: "flare / sunburst", pro: "flare / sunburst (우선 큐)", max: "flare / sunburst (초고속 GPU 큐)", highlight: true },
      { name: "출석 체크 보상", free: "매일 1C (7일 연속 +1C, 상한 없음)", pro: "동일", max: "동일" },
      { name: "최대 컷 수 (회차당)", free: "최대 4컷", pro: "최대 8컷", max: "무제한" },
      { name: "이미지 출력 해상도", free: "1K (1080×1080)", pro: "2K 고해상도", max: "4K Ultra HD" },
      { name: "생성 대기 큐", free: "일반 대기열", pro: "Fast 우선 생성", max: "Turbo 전용 GPU (대기 0초)" },
      { name: "크레딧 추가 충전 할인", free: "정가", pro: "10% 할인", max: "20% 추가 할인" },
    ],
  },
  {
    category: "화풍 & 에셋 일관성",
    items: [
      { name: "제공 웹툰 화풍 프리셋", free: "기본 6종", pro: "전체 12종 + 커스텀", max: "전체 12종 + 무제한" },
      { name: "고정 에셋(캐릭터/소품/배경) 등록", free: "최대 3개", pro: "최대 20개", max: "무제한 등록", highlight: true },
      { name: "나만의 그림체 학습 (Custom LoRA)", free: false, pro: false, max: "지원 (월 1회 무료 학습)" },
      { name: "셀카 기반 주인공 캐릭터 생성", free: "기본 생성", pro: "고화질 정밀 생성", max: "다각도 3D 회전 생성" },
    ],
  },
  {
    category: "에디터 & 원본 리소스",
    items: [
      { name: "텍스트 및 말풍선 편집", free: true, pro: true, max: true },
      { name: "배경·인물·말풍선 4중 레이어 분리", free: false, pro: true, max: true, highlight: true },
      { name: "컷별 재생성 & 부분 인페인팅", free: "기본", pro: "무제한", max: "무제한" },
      { name: "포토샵/클립스튜디오 원본(PSD) 내보내기", free: false, pro: false, max: true },
      { name: "투명 배경 PNG 인물 컷 다운로드", free: false, pro: true, max: true },
    ],
  },
  {
    category: "SNS 연재 & 비즈니스(수익화)",
    items: [
      { name: "Sharktoon 워터마크", free: "표시됨", pro: "완전 제거", max: "완전 제거", highlight: true },
      { name: "상업적 이용 및 협찬 광고툰 게재", free: false, pro: true, max: true },
      { name: "인스타그램 연동 & 즉시 발행", free: "수동 다운로드 (외부 게시)", pro: "원클릭 즉시 발행", max: "원클릭 즉시 발행" },
      { name: "인스타그램 자동 예약 발행", free: "미지원 (수동 발행)", pro: "지원 (자동 예약)", max: "지원 (자동 예약)", highlight: true },
      { name: "AI 독자 반응 피드백 & 소재 추천", free: "기본 요약 안내", pro: "정밀 분석 & 맞춤 제안", max: "정밀 분석 & 맞춤 제안" },
      { name: "실시간 협찬 미디어킷 웹 링크", free: "기본 요약", pro: "공식 링크 공유", max: "공식 링크 공유" },
      { name: "협찬 미디어킷 PDF 다운로드", free: false, pro: true, max: true },
      { name: "브랜드 광고주 협찬 매칭 풀 노출", free: false, pro: false, max: "우선 매칭 노출" },
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
    question: "어떤 AI 생성 모델이 사용되나요?",
    answer:
      "Sharktoon은 서비스 평판과 일관성을 위해 저품질 오픈소스 모델을 배제하고, 공식 벤치마크를 통과한 고품질 flare 및 sunburst 파이프라인(OpenAI DALL-E 3 기반)만을 실서비스에 적용하고 있습니다. 이를 통해 캐릭터 일관성과 뛰어난 웹툰 완성도를 보장합니다.",
  },
  {
    question: "인스타그램 연동은 무료 플랜에서도 가능한가요?",
    answer:
      "무료 플랜에서도 계정을 연결하여 최근 도달 수와 저장 수 같은 기본 성과 요약을 확인하실 수 있습니다. 단, 완성작의 1-Click 피드 즉시 발행, 자동 예약 발행 스케줄러, 실시간 독자 반응(저장률·공유율) 정밀 AI 피드백, 협찬 미디어킷 PDF 다운로드는 Pro 및 Max 플랜에서 지원됩니다.",
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
  {
    question: "상업적 이용(기업 브랜드 협찬 광고툰)은 어떤 플랜부터 가능한가요?",
    answer:
      "Pro 플랜부터 워터마크가 완전히 제거되며, 협찬 광고툰, 인스타툰 책 출판, 브랜드 외주 납품 등 모든 상업적 권리와 수익 창출이 100% 작가님에게 보장됩니다.",
  },
  {
    question: "나만의 그림체 커스텀 학습(LoRA)은 어떻게 진행되나요?",
    answer:
      "Max 플랜 회원에게 제공되는 기능으로, 작가님이 직접 그린 일러스트나 기존 원고 15~20장을 업로드하시면 Sharktoon 전용 GPU 클러스터에서 단독 LoRA 모델로 미세조정(Fine-tuning)하여 다른 작가와 차별화된 독점 화풍으로 생성할 수 있습니다.",
  },
];
