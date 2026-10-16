/**
 * 소재(Asset) 기본 일러스트와 화풍 프리셋. 소재는 사용자가 직접 등록한다(AI 가 사연에서 만들지 않는다).
 *
 * 소재가 빈 화면이나 무의미한 클립아트로 나오지 않도록 작품의 화풍과
 * 인물·동물·장소·소품 설정을 충실히 반영한 고품질 웹툰 일러스트를 생성합니다.
 * 첫 화 사연(Story)이 입력되면 사연에 실제로 등장하는 인물, 배경, 소품을 정밀 추출해 등록합니다.
 */

import type { AssetKind } from "../data/types";

// 화풍별 대표 컬러 팔레트 및 시각적 설정
export const STYLE_PALETTES: Record<
  string,
  {
    bg: string;
    line: string;
    accent: string;
    sub: string;
    strokeWidth: number;
    dashArray?: string;
    name: string;
  }
> = {
  "심플 라인": {
    bg: "#F8FAFC",
    line: "#1E293B",
    accent: "#0EA5E9",
    sub: "#CBD5E1",
    strokeWidth: 2.2,
    name: "심플 라인",
  },
  "파스텔": {
    bg: "#FFFBEB",
    line: "#78350F",
    accent: "#FB923C",
    sub: "#FED7AA",
    strokeWidth: 2.0,
    name: "파스텔",
  },
  "굵은 선": {
    bg: "#F1F5F9",
    line: "#09090B",
    accent: "#6366F1",
    sub: "#94A3B8",
    strokeWidth: 4.5,
    name: "굵은 선",
  },
  "명랑 코믹": {
    bg: "#FEF08A",
    line: "#713F12",
    accent: "#EF4444",
    sub: "#FBBF24",
    strokeWidth: 3.0,
    name: "명랑 코믹",
  },
  "감성 색연필": {
    bg: "#FDF4FF",
    line: "#581C87",
    accent: "#D946EF",
    sub: "#F5D0FE",
    strokeWidth: 2.2,
    dashArray: "12 2",
    name: "감성 색연필",
  },
  "모던 K-웹툰": {
    bg: "#F0FDFA",
    line: "#0F172A",
    accent: "#0D9488",
    sub: "#99F6E4",
    strokeWidth: 1.8,
    name: "모던 K-웹툰",
  },
};

export function getPalette(style?: string) {
  if (style && STYLE_PALETTES[style]) return STYLE_PALETTES[style];
  return {
    bg: "#F8FAFC",
    line: "#1E293B",
    accent: "#4F46E5",
    sub: "#E2E8F0",
    strokeWidth: 2.2,
    name: style || "커스텀 화풍",
  };
}

/**
 * 인물(캐릭터), 동물, 장소, 소품별 작품 스타일 & 인물 설정 완벽 동기화 웹툰 벡터 일러스트 SVG 생성
 */
export function generateAssetIllustrationSvg(params: {
  name: string;
  kind: AssetKind | "animal";
  description?: string | null;
  tags?: string[];
  style?: string;
  customStyleImageUrl?: string | null;
}): string {
  const { name, kind, description = "", tags = [], style, customStyleImageUrl } = params;
  const p = getPalette(style);
  const textInfo = `${name} ${description || ""} ${tags.join(" ")}`.toLowerCase();

  const isCat = textInfo.includes("고양이") || textInfo.includes("냥") || textInfo.includes("cat");
  const isDog = textInfo.includes("강아지") || textInfo.includes("개") || textInfo.includes("포메") || textInfo.includes("댕댕") || textInfo.includes("리트리버");
  const isAnimal = kind === "animal" || isCat || isDog || tags.includes("동물") || textInfo.includes("반려");

  const strokeDash = p.dashArray ? `stroke-dasharray="${p.dashArray}"` : "";
  const isModernManhwa = style === "모던 K-웹툰";
  const isColoredPencil = style === "감성 색연필";
  const isBoldLine = style === "굵은 선";
  const isPastel = style === "파스텔";
  const isCheerful = style === "명랑 코믹";

  let contentSvg = "";

  if (isAnimal) {
    if (isDog) {
      // 강아지 (포메라니안 / 귀여운 반려견)
      contentSvg = `
        <circle cx="100" cy="100" r="54" fill="${p.sub}" opacity="0.35" />
        <!-- 강아지 얼굴 복슬복슬 털 -->
        <circle cx="100" cy="98" r="44" fill="#FFFFFF" stroke="${p.line}" stroke-width="${p.strokeWidth}" ${strokeDash} />
        <!-- 귀 -->
        <polygon points="66,62 80,40 92,62" fill="#FED7AA" stroke="${p.line}" stroke-width="${p.strokeWidth}" stroke-linejoin="round" />
        <polygon points="134,62 120,40 108,62" fill="#FED7AA" stroke="${p.line}" stroke-width="${p.strokeWidth}" stroke-linejoin="round" />
        <!-- 눈 -->
        <circle cx="86" cy="94" r="5.5" fill="${p.line}" />
        <circle cx="88" cy="92" r="2.0" fill="#FFFFFF" />
        <circle cx="114" cy="94" r="5.5" fill="${p.line}" />
        <circle cx="116" cy="92" r="2.0" fill="#FFFFFF" />
        <!-- 코 & 입 -->
        <ellipse cx="100" cy="106" rx="4.5" ry="3.5" fill="${p.line}" />
        <path d="M 96 112 Q 100 116 104 112" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.8}" fill="none" stroke-linecap="round" />
        <!-- 혓바닥 -->
        <path d="M 98 114 Q 100 122 102 114 Z" fill="#F43F5E" />
        <!-- 볼터치 -->
        <ellipse cx="76" cy="104" rx="6.5" ry="4" fill="#FDA4AF" opacity="${isPastel ? "0.8" : "0.5"}" />
        <ellipse cx="124" cy="104" rx="6.5" ry="4" fill="#FDA4AF" opacity="${isPastel ? "0.8" : "0.5"}" />
        <!-- 스카프 / 방울 목걸이 -->
        <path d="M 76 134 Q 100 144 124 134 L 100 156 Z" fill="${p.accent}" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.8}" />
      `;
    } else {
      // 고양이 (치즈 태비 / 호기심 많은 야옹이)
      contentSvg = `
        <circle cx="100" cy="100" r="54" fill="${p.sub}" opacity="0.35" />
        <!-- 고양이 얼굴 -->
        <ellipse cx="100" cy="100" rx="46" ry="40" fill="#FFEDD5" stroke="${p.line}" stroke-width="${p.strokeWidth}" ${strokeDash} />
        <!-- 뾰족 귀 -->
        <polygon points="60,72 64,38 88,64" fill="#FDBA74" stroke="${p.line}" stroke-width="${p.strokeWidth}" stroke-linejoin="round" />
        <polygon points="68,68 70,48 82,64" fill="#FDA4AF" />
        <polygon points="140,72 136,38 112,64" fill="#FDBA74" stroke="${p.line}" stroke-width="${p.strokeWidth}" stroke-linejoin="round" />
        <polygon points="132,68 130,48 118,64" fill="#FDA4AF" />
        <!-- 줄무늬 -->
        <path d="M 94 66 L 94 76 M 100 65 L 100 80 M 106 66 L 106 76" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.7}" stroke-linecap="round" />
        <!-- 큰 눈 -->
        <ellipse cx="84" cy="96" rx="6" ry="7" fill="${p.line}" />
        <circle cx="86" cy="93" r="2.2" fill="#FFFFFF" />
        <ellipse cx="116" cy="96" rx="6" ry="7" fill="${p.line}" />
        <circle cx="118" cy="93" r="2.2" fill="#FFFFFF" />
        <!-- 코 & 입 -->
        <polygon points="98,105 102,105 100,108" fill="#F43F5E" />
        <path d="M 94 111 Q 100 115 100 108 Q 100 115 106 111" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.7}" fill="none" stroke-linecap="round" />
        <!-- 수염 -->
        <line x1="56" y1="98" x2="74" y2="102" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.6}" stroke-linecap="round" />
        <line x1="54" y1="108" x2="73" y2="108" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.6}" stroke-linecap="round" />
        <line x1="144" y1="98" x2="126" y2="102" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.6}" stroke-linecap="round" />
        <line x1="146" y1="108" x2="127" y2="108" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.6}" stroke-linecap="round" />
        <!-- 볼터치 -->
        <circle cx="74" cy="106" r="5" fill="#FDA4AF" opacity="0.6" />
        <circle cx="126" cy="106" r="5" fill="#FDA4AF" opacity="0.6" />
      `;
    }
  } else if (kind === "character") {
    // 인물 설정 판별
    const isFemale = textInfo.includes("여성") || textInfo.includes("여자") || textInfo.includes("소녀") || textInfo.includes("단발") || textInfo.includes("엄마") || textInfo.includes("언니") || textInfo.includes("누나") || textInfo.includes("여학생") || textInfo.includes("동료");
    const isDoctor = textInfo.includes("의사") || textInfo.includes("수의사") || textInfo.includes("원장") || textInfo.includes("간호사");
    const isBoss = textInfo.includes("부장") || textInfo.includes("팀장") || textInfo.includes("상사") || textInfo.includes("대표") || textInfo.includes("이사") || textInfo.includes("아빠") || textInfo.includes("중년");
    const isStudent = textInfo.includes("학생") || textInfo.includes("교복") || textInfo.includes("고등학생") || textInfo.includes("대학생");
    const hasGlasses = textInfo.includes("안경") || (!isFemale && !isBoss && !isDoctor && textInfo.includes("사원"));

    // 1. 수의사 / 의사 선생님
    if (isDoctor) {
      contentSvg = `
        <circle cx="100" cy="100" r="55" fill="${p.sub}" opacity="0.3" />
        <!-- 흰색 가운 & 이너 셔츠 -->
        <path d="M 50 162 C 50 134, 75 125, 100 125 C 125 125, 150 134, 150 162 Z" fill="#F8FAFC" stroke="${p.line}" stroke-width="${p.strokeWidth}" />
        <!-- 민트색 스크럽 셔츠 -->
        <polygon points="90,125 110,125 100,146" fill="#14B8A6" />
        <!-- 청진기 -->
        <path d="M 82 125 C 80 148, 120 148, 118 125" stroke="#334155" stroke-width="3" fill="none" />
        <circle cx="108" cy="148" r="6" fill="#94A3B8" stroke="${p.line}" stroke-width="1.8" />
        <!-- 얼굴 -->
        <ellipse cx="100" cy="85" rx="33" ry="36" fill="#FEF3C7" stroke="${p.line}" stroke-width="${p.strokeWidth}" ${strokeDash} />
        <!-- 단정한 헤어 -->
        <path d="M 66 80 C 64 52, 85 45, 100 45 C 118 45, 138 52, 134 80 C 130 62, 116 56, 100 56 C 84 56, 70 62, 66 80 Z" fill="#334155" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.9}" />
        <!-- 눈 (따스하고 신뢰감 있는 눈빛) -->
        <ellipse cx="86" cy="87" rx="4" ry="5" fill="${p.line}" />
        <circle cx="87" cy="85" r="1.5" fill="#FFFFFF" />
        <ellipse cx="114" cy="87" rx="4" ry="5" fill="${p.line}" />
        <circle cx="115" cy="85" r="1.5" fill="#FFFFFF" />
        <!-- 미소 -->
        <path d="M 94 103 Q 100 108 106 103" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.8}" fill="none" stroke-linecap="round" />
        <!-- 안경 (옵션) -->
        ${hasGlasses ? `
          <circle cx="86" cy="87" r="10" fill="none" stroke="${p.line}" stroke-width="2.5" />
          <circle cx="114" cy="87" r="10" fill="none" stroke="${p.line}" stroke-width="2.5" />
          <line x1="96" y1="87" x2="104" y2="87" stroke="${p.line}" stroke-width="2.5" />
        ` : ""}
      `;
    }
    // 2. 직장 상사 / 부장님
    else if (isBoss) {
      contentSvg = `
        <circle cx="100" cy="100" r="55" fill="${p.sub}" opacity="0.3" />
        <!-- 어깨 & 양복 -->
        <path d="M 48 162 C 48 134, 75 124, 100 124 C 125 124, 152 134, 152 162 Z" fill="#1E293B" stroke="${p.line}" stroke-width="${p.strokeWidth}" />
        <!-- 와이셔츠 & 붉은 넥타이 -->
        <polygon points="90,124 110,124 100,142" fill="#FFFFFF" />
        <polygon points="96,134 104,134 106,160 100,166 94,160" fill="${p.accent}" stroke="${p.line}" stroke-width="2" />
        <!-- 얼굴 (각진 턱) -->
        <path d="M 68 76 C 68 106, 80 118, 100 118 C 120 118, 132 106, 132 76 C 132 55, 118 52, 100 52 C 82 52, 68 55, 68 76 Z" fill="#FED7AA" stroke="${p.line}" stroke-width="${p.strokeWidth}" ${strokeDash} />
        <!-- 2:8 가르마 중후한 헤어 -->
        <path d="M 66 78 C 64 52, 85 45, 100 45 C 120 45, 136 52, 134 78 C 130 62, 115 56, 100 56 C 85 56, 70 62, 66 78 Z" fill="#0F172A" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.9}" />
        <!-- 짙은 눈썹 -->
        <path d="M 76 74 L 92 78" stroke="${p.line}" stroke-width="4.5" stroke-linecap="round" />
        <path d="M 124 74 L 108 78" stroke="${p.line}" stroke-width="4.5" stroke-linecap="round" />
        <!-- 날카로운 눈 -->
        <path d="M 78 86 Q 86 82 92 86" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.9}" fill="none" stroke-linecap="round" />
        <path d="M 108 86 Q 114 82 122 86" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.9}" fill="none" stroke-linecap="round" />
        <!-- 굳게 다문 입 -->
        <line x1="92" y1="106" x2="108" y2="106" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.9}" stroke-linecap="round" />
      `;
    }
    // 3. 여성 캐릭터 (단발, 학생, 동료, 주인공)
    else if (isFemale) {
      const isLongHair = textInfo.includes("긴머리") || textInfo.includes("웨이브") || textInfo.includes("롱헤어");
      contentSvg = `
        <circle cx="100" cy="100" r="55" fill="${p.sub}" opacity="0.35" />
        <!-- 뒷머리 (긴머리일 경우) -->
        ${isLongHair ? `
          <path d="M 58 80 C 52 110, 56 145, 72 158 L 128 158 C 144 145, 148 110, 142 80 Z" fill="#451A03" stroke="${p.line}" stroke-width="${p.strokeWidth}" />
        ` : ""}
        <!-- 상의 니트/블라우스 -->
        <path d="M 54 162 C 54 138, 76 128, 100 128 C 124 128, 146 138, 146 162 Z" fill="${p.sub}" stroke="${p.line}" stroke-width="${p.strokeWidth}" />
        <!-- 목 -->
        <rect x="93" y="112" width="14" height="20" fill="#FFEDD5" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.8}" />
        <!-- 계란형 V라인 얼굴 -->
        <path d="M 70 78 C 70 102, 85 116, 100 118 C 115 116, 130 102, 130 78 C 130 54, 115 50, 100 50 C 85 50, 70 54, 70 78 Z" fill="#FFF1F2" stroke="${p.line}" stroke-width="${p.strokeWidth}" ${strokeDash} />
        <!-- 세련된 헤어스타일 (단발 or 앞머리) -->
        <path d="M 64 82 C 60 52, 85 44, 100 44 C 118 44, 138 52, 136 82 C 140 105, 132 114, 126 116 C 124 102, 126 88, 124 78 C 115 62, 85 62, 76 78 C 74 88, 76 102, 74 116 C 68 114, 60 105, 64 82 Z" fill="#451A03" stroke="${p.line}" stroke-width="${p.strokeWidth}" stroke-linejoin="round" />
        <!-- 반짝이는 눈 & 속눈썹 -->
        <ellipse cx="85" cy="86" rx="5" ry="6" fill="${p.line}" />
        <circle cx="87" cy="84" r="2.0" fill="#FFFFFF" />
        ${isModernManhwa ? `<path d="M 78 82 Q 86 78 92 83" stroke="${p.line}" stroke-width="2.5" fill="none" stroke-linecap="round" />` : ""}
        <ellipse cx="115" cy="86" rx="5" ry="6" fill="${p.line}" />
        <circle cx="117" cy="84" r="2.0" fill="#FFFFFF" />
        ${isModernManhwa ? `<path d="M 108 83 Q 114 78 122 82" stroke="${p.line}" stroke-width="2.5" fill="none" stroke-linecap="round" />` : ""}
        <!-- 사랑스러운 미소 -->
        <path d="M 95 102 Q 100 107 105 102" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.8}" fill="none" stroke-linecap="round" />
        <!-- 핑크 볼터치 -->
        <circle cx="76" cy="94" r="5.5" fill="#FDA4AF" opacity="0.75" />
        <circle cx="124" cy="94" r="5.5" fill="#FDA4AF" opacity="0.75" />
      `;
    }
    // 4. 청년 / 주인공 (나)
    else {
      contentSvg = `
        <circle cx="100" cy="100" r="55" fill="${p.sub}" opacity="0.3" />
        <!-- 캐주얼 후드/셔츠 -->
        <path d="M 48 162 C 48 134, 72 122, 100 122 C 128 122, 152 134, 152 162 Z" fill="${isBoldLine ? "#3B82F6" : "#475569"}" stroke="${p.line}" stroke-width="${p.strokeWidth}" />
        <path d="M 86 122 C 86 136, 114 136, 114 122" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.8}" fill="#E2E8F0" />
        <!-- 얼굴 -->
        <ellipse cx="100" cy="84" rx="33" ry="36" fill="#FEF08A" stroke="${p.line}" stroke-width="${p.strokeWidth}" ${strokeDash} />
        <!-- 흑발 투블럭/댄디컷 -->
        <path d="M 64 78 C 62 50, 85 44, 100 44 C 118 44, 138 50, 136 78 C 132 60, 116 54, 100 54 C 84 54, 68 60, 64 78 Z" fill="#0F172A" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.9}" />
        <!-- 눈 -->
        <circle cx="85" cy="85" r="4.5" fill="${p.line}" />
        <circle cx="87" cy="83" r="1.5" fill="#FFFFFF" />
        <circle cx="115" cy="85" r="4.5" fill="${p.line}" />
        <circle cx="117" cy="83" r="1.5" fill="#FFFFFF" />
        <!-- 덤덤하거나 유쾌한 표정 -->
        ${isCheerful ? `
          <path d="M 92 101 Q 100 114 108 101 Z" fill="#DC2626" stroke="${p.line}" stroke-width="2" />
        ` : `
          <line x1="94" y1="104" x2="106" y2="104" stroke="${p.line}" stroke-width="${p.strokeWidth * 0.8}" stroke-linecap="round" />
        `}
        <!-- 안경 (옵션 또는 일상툰 기본) -->
        ${hasGlasses ? `
          <circle cx="85" cy="85" r="11" fill="none" stroke="${p.line}" stroke-width="2.8" />
          <circle cx="115" cy="85" r="11" fill="none" stroke="${p.line}" stroke-width="2.8" />
          <line x1="96" y1="85" x2="104" y2="85" stroke="${p.line}" stroke-width="2.8" />
        ` : ""}
      `;
    }
  } else if (kind === "location") {
    // 장소 (배경) 일러스트
    const isClinic = textInfo.includes("병원") || textInfo.includes("동물병원") || textInfo.includes("진료");
    const isPantry = textInfo.includes("탕비실") || textInfo.includes("커피") || textInfo.includes("휴게");
    const isLivingRoom = textInfo.includes("거실") || textInfo.includes("원룸") || textInfo.includes("방") || textInfo.includes("캣타워");

    if (isClinic) {
      // 동물병원 / 진료실
      contentSvg = `
        <rect x="35" y="42" width="130" height="116" fill="#F8FAFC" stroke="${p.line}" stroke-width="${p.strokeWidth}" rx="8" />
        <!-- 십자 마크 -->
        <rect x="92" y="54" width="16" height="24" fill="#10B981" rx="2" />
        <rect x="88" y="58" width="24" height="16" fill="#10B981" rx="2" />
        <!-- 진료대 테이블 -->
        <rect x="50" y="110" width="100" height="34" fill="#E2E8F0" stroke="${p.line}" stroke-width="${p.strokeWidth}" rx="4" />
        <!-- 청진기와 모니터 차트 -->
        <rect x="58" y="85" width="30" height="22" fill="#0EA5E9" opacity="0.8" rx="3" />
        <line x1="62" y1="96" x2="84" y2="96" stroke="#FFFFFF" stroke-width="2" />
      `;
    } else if (isPantry) {
      // 탕비실 (커피머신 & 선반)
      contentSvg = `
        <rect x="35" y="42" width="130" height="116" fill="#F1F5F9" stroke="${p.line}" stroke-width="${p.strokeWidth}" rx="8" />
        <line x1="35" y1="80" x2="165" y2="80" stroke="${p.line}" stroke-width="1.5" stroke-dasharray="4 4" />
        <rect x="30" y="120" width="140" height="36" fill="#E2E8F0" stroke="${p.line}" stroke-width="${p.strokeWidth}" rx="4" />
        <!-- 커피 머신 -->
        <rect x="55" y="70" width="38" height="50" fill="#334155" stroke="${p.line}" stroke-width="2.5" rx="4" />
        <rect x="62" y="78" width="24" height="16" fill="#0EA5E9" opacity="0.7" rx="2" />
        <circle cx="74" cy="105" r="4" fill="#EF4444" />
        <!-- 스팀 연기 -->
        <path d="M 72 62 Q 76 54 72 46" stroke="${p.accent}" stroke-width="2" fill="none" stroke-linecap="round" />
        <path d="M 78 62 Q 82 54 78 46" stroke="${p.accent}" stroke-width="2" fill="none" stroke-linecap="round" />
      `;
    } else if (isLivingRoom) {
      // 거실 & 캣타워 / 창가
      contentSvg = `
        <rect x="35" y="42" width="130" height="116" fill="#FFFBEB" stroke="${p.line}" stroke-width="${p.strokeWidth}" rx="8" />
        <!-- 따스한 창문 -->
        <rect x="46" y="52" width="46" height="50" fill="#FEF08A" stroke="${p.line}" stroke-width="2" rx="4" />
        <line x1="69" y1="52" x2="69" y2="102" stroke="${p.line}" stroke-width="2" />
        <line x1="46" y1="77" x2="92" y2="77" stroke="${p.line}" stroke-width="2" />
        <!-- 아늑한 소파 -->
        <rect x="42" y="112" width="80" height="38" fill="#F97316" opacity="0.85" rx="6" stroke="${p.line}" stroke-width="2.5" />
        <!-- 캣타워 기둥과 발판 -->
        <rect x="134" y="60" width="8" height="90" fill="#78350F" />
        <ellipse cx="138" cy="72" rx="18" ry="6" fill="#FDBA74" stroke="${p.line}" stroke-width="1.8" />
        <ellipse cx="138" cy="108" rx="18" ry="6" fill="#FDBA74" stroke="${p.line}" stroke-width="1.8" />
      `;
    } else {
      // 일반 사무실 / 회의실
      contentSvg = `
        <rect x="35" y="42" width="130" height="116" fill="#F8FAFC" stroke="${p.line}" stroke-width="${p.strokeWidth}" rx="8" />
        <rect x="45" y="52" width="42" height="46" fill="#E0F2FE" stroke="${p.line}" stroke-width="2" rx="4" />
        <rect x="98" y="52" width="55" height="40" fill="#FFFFFF" stroke="${p.line}" stroke-width="2" rx="3" />
        <polygon points="30,138 170,138 155,114 45,114" fill="#CBD5E1" stroke="${p.line}" stroke-width="${p.strokeWidth}" stroke-linejoin="round" />
      `;
    }
  } else {
    // 소품 (물건) 일러스트
    const isChuru = textInfo.includes("츄르") || textInfo.includes("간식") || textInfo.includes("사료");
    const isDoc = textInfo.includes("서류") || textInfo.includes("기획서") || textInfo.includes("결재판") || textInfo.includes("보고서");
    const isMug = textInfo.includes("머그") || textInfo.includes("커피") || textInfo.includes("텀블러");

    if (isChuru) {
      // 츄르 간식 파우치 & 낚싯대
      contentSvg = `
        <circle cx="100" cy="100" r="54" fill="${p.sub}" opacity="0.3" />
        <!-- 츄르 스틱 비닐 봉투 -->
        <g transform="rotate(-25 100 100)">
          <rect x="74" y="45" width="52" height="110" rx="8" fill="#F43F5E" stroke="${p.line}" stroke-width="${p.strokeWidth}" />
          <rect x="74" y="62" width="52" height="30" fill="#FED7AA" />
          <circle cx="100" cy="77" r="8" fill="#FB923C" />
          <text x="100" y="80" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">CHURU</text>
          <!-- 뜯는 선 -->
          <line x1="74" y1="52" x2="126" y2="52" stroke="#FFFFFF" stroke-dasharray="2 2" stroke-width="2" />
        </g>
      `;
    } else if (isDoc) {
      // 결재판 서류철과 기획서
      contentSvg = `
        <circle cx="100" cy="100" r="54" fill="${p.sub}" opacity="0.3" />
        <g transform="rotate(-8 100 100)">
          <!-- 남색 결재판 바인더 -->
          <rect x="52" y="48" width="96" height="116" rx="6" fill="#1E293B" stroke="${p.line}" stroke-width="${p.strokeWidth}" />
          <!-- 흰색 서류 용지 -->
          <rect x="60" y="56" width="80" height="100" rx="4" fill="#FFFFFF" />
          <!-- 상단 은색 클립 -->
          <rect x="85" y="44" width="30" height="16" rx="3" fill="#94A3B8" stroke="${p.line}" stroke-width="2" />
          <!-- 결재 도장 및 서류 텍스트 라인 -->
          <line x1="70" y1="72" x2="120" y2="72" stroke="#64748B" stroke-width="3" stroke-linecap="round" />
          <line x1="70" y1="84" x2="130" y2="84" stroke="#CBD5E1" stroke-width="2" />
          <line x1="70" y1="94" x2="125" y2="94" stroke="#CBD5E1" stroke-width="2" />
          <line x1="70" y1="104" x2="115" y2="104" stroke="#CBD5E1" stroke-width="2" />
          <!-- 빨간색 검토 도장 -->
          <circle cx="124" cy="132" r="11" fill="none" stroke="#EF4444" stroke-width="2.5" />
          <text x="124" y="136" font-size="9" font-weight="bold" fill="#EF4444" text-anchor="middle">반려</text>
        </g>
      `;
    } else if (isMug) {
      // 커피 머그잔 / 텀블러
      contentSvg = `
        <circle cx="100" cy="100" r="54" fill="${p.sub}" opacity="0.3" />
        <!-- 머그 손잡이 -->
        <path d="M 126 80 C 148 80, 148 120, 126 120" stroke="${p.line}" stroke-width="4.5" fill="none" stroke-linecap="round" />
        <!-- 머그 몸체 -->
        <rect x="64" y="68" width="64" height="68" rx="8" fill="${p.accent}" stroke="${p.line}" stroke-width="${p.strokeWidth}" />
        <ellipse cx="96" cy="68" rx="32" ry="8" fill="#FFFFFF" stroke="${p.line}" stroke-width="2.5" />
        <ellipse cx="96" cy="68" rx="27" ry="6" fill="#78350F" />
        <!-- 모락모락 스팀 연기 -->
        <path d="M 88 56 Q 84 46 90 38" stroke="${p.line}" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <path d="M 98 54 Q 102 44 96 36" stroke="${p.line}" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <path d="M 108 56 Q 104 46 110 38" stroke="${p.line}" stroke-width="2.5" fill="none" stroke-linecap="round" />
      `;
    } else {
      // 스마트폰 / 스마트 워치
      contentSvg = `
        <circle cx="100" cy="100" r="54" fill="${p.sub}" opacity="0.3" />
        <g transform="rotate(10 100 100)">
          <rect x="68" y="52" width="64" height="106" rx="10" fill="#1E293B" stroke="${p.line}" stroke-width="${p.strokeWidth}" />
          <rect x="72" y="60" width="56" height="88" rx="4" fill="#38BDF8" />
          <!-- 홈 버튼 바 -->
          <line x1="90" y1="144" x2="110" y2="144" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" />
        </g>
      `;
    }
  }

  // 상단 화풍 뱃지 데코레이션
  const badgeText = style || "심플 라인";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
      <rect width="200" height="200" fill="${p.bg}" />
      ${contentSvg}
      <!-- 화풍 식별 뱃지 -->
      <g transform="translate(10, 14)">
        <rect width="${Math.max(50, badgeText.length * 11 + 12)}" height="18" rx="9" fill="${p.line}" opacity="0.85" />
        <text x="7" y="12" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="9" font-weight="700" fill="#FFFFFF">${badgeText}</text>
      </g>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface StylePresetMeta {
  id: string;
  name: string;
  badge: string;
  description: string;
  sampleSvg: string;
  imageUrl: string;
}

/**
 * 화풍별 대표 비주얼 예시 일러스트 SVG 생성기
 */
export function generateStyleSampleSvg(style: string): string {
  let content = "";
  if (style === "파스텔") {
    content = `
      <rect width="200" height="150" fill="#FFF7ED" />
      <circle cx="100" cy="75" r="50" fill="#FED7AA" opacity="0.4" />
      <path d="M 60 140 C 60 115, 80 105, 100 105 C 120 105, 140 115, 140 140 Z" fill="#FB923C" stroke="#7C2D12" stroke-width="2.5" />
      <ellipse cx="100" cy="72" rx="30" ry="32" fill="#FFEDD5" stroke="#7C2D12" stroke-width="2.5" />
      <path d="M 72 65 C 70 45, 88 40, 100 40 C 112 40, 130 45, 128 65 C 124 50, 112 48, 100 48 C 88 48, 76 50, 72 65 Z" fill="#9A3412" stroke="#7C2D12" stroke-width="2" />
      <circle cx="88" cy="72" r="3.5" fill="#7C2D12" />
      <circle cx="112" cy="72" r="3.5" fill="#7C2D12" />
      <path d="M 94 84 Q 100 88 106 84" stroke="#7C2D12" stroke-width="2" fill="none" stroke-linecap="round" />
      <ellipse cx="80" cy="80" rx="5" ry="3.5" fill="#FDA4AF" opacity="0.8" />
      <ellipse cx="120" cy="80" rx="5" ry="3.5" fill="#FDA4AF" opacity="0.8" />
    `;
  } else if (style === "굵은 선") {
    content = `
      <rect width="200" height="150" fill="#F1F5F9" />
      <rect x="20" y="15" width="160" height="120" fill="#FFFFFF" stroke="#0F172A" stroke-width="4" rx="10" />
      <path d="M 52 135 C 52 110, 75 100, 100 100 C 125 100, 148 110, 148 135 Z" fill="#6366F1" stroke="#0F172A" stroke-width="4" />
      <ellipse cx="100" cy="68" rx="32" ry="34" fill="#FEF08A" stroke="#0F172A" stroke-width="4" />
      <path d="M 68 62 C 65 38, 85 32, 100 32 C 115 32, 135 38, 132 62 Z" fill="#0F172A" />
      <circle cx="88" cy="72" r="5" fill="#0F172A" />
      <circle cx="112" cy="72" r="5" fill="#0F172A" />
      <path d="M 92 84 L 108 84" stroke="#0F172A" stroke-width="4" stroke-linecap="round" />
    `;
  } else if (style === "명랑 코믹") {
    content = `
      <rect width="200" height="150" fill="#FEF08A" />
      <polygon points="100,75 180,20 160,50" fill="#FDE047" opacity="0.6" />
      <polygon points="100,75 20,20 40,50" fill="#FDE047" opacity="0.6" />
      <path d="M 55 140 C 55 118, 75 108, 100 108 C 125 108, 145 118, 145 140 Z" fill="#EF4444" stroke="#713F12" stroke-width="3" />
      <ellipse cx="100" cy="74" rx="33" ry="34" fill="#FED7AA" stroke="#713F12" stroke-width="3" />
      <path d="M 68 65 C 66 40, 88 35, 100 35 C 112 35, 134 40, 132 65 Z" fill="#1C1917" stroke="#713F12" stroke-width="2.5" />
      <path d="M 80 70 Q 88 64 94 70" stroke="#713F12" stroke-width="3.5" fill="none" stroke-linecap="round" />
      <circle cx="114" cy="70" r="4.5" fill="#713F12" />
      <circle cx="115" cy="69" r="1.5" fill="#FFFFFF" />
      <path d="M 90 82 Q 100 96 110 82 Z" fill="#DC2626" stroke="#713F12" stroke-width="2" />
    `;
  } else if (style === "감성 색연필") {
    content = `
      <rect width="200" height="150" fill="#FDF4FF" />
      <circle cx="100" cy="75" r="55" fill="#FBCFE8" opacity="0.4" />
      <path d="M 58 140 C 58 120, 78 112, 100 112 C 122 112, 142 120, 142 140 Z" fill="#E879F9" stroke="#581C87" stroke-width="2" stroke-dasharray="8 2" />
      <ellipse cx="100" cy="75" rx="31" ry="33" fill="#FFF1F2" stroke="#581C87" stroke-width="2.2" stroke-dasharray="12 2" />
      <path d="M 70 70 C 68 50, 88 44, 100 44 C 112 44, 132 50, 130 70 Z" fill="#701A75" stroke="#581C87" stroke-width="2" />
      <circle cx="87" cy="74" r="3.2" fill="#581C87" />
      <circle cx="113" cy="74" r="3.2" fill="#581C87" />
      <path d="M 95 86 Q 100 90 105 86" stroke="#581C87" stroke-width="1.8" fill="none" stroke-linecap="round" />
      <circle cx="78" cy="82" r="4" fill="#F472B6" opacity="0.6" />
      <circle cx="122" cy="82" r="4" fill="#F472B6" opacity="0.6" />
    `;
  } else if (style === "모던 K-웹툰") {
    content = `
      <rect width="200" height="150" fill="#F0FDFA" />
      <path d="M 55 140 C 55 118, 75 110, 100 110 C 125 110, 145 118, 145 140 Z" fill="#14B8A6" stroke="#134E4A" stroke-width="2.5" />
      <path d="M 72 65 C 72 85, 85 102, 100 106 C 115 102, 128 85, 128 65 C 128 45, 116 42, 100 42 C 84 42, 72 45, 72 65 Z" fill="#FEF9C3" stroke="#134E4A" stroke-width="2.2" />
      <path d="M 68 62 C 66 38, 86 32, 100 32 C 114 32, 134 38, 132 62 C 128 50, 116 46, 100 46 C 84 46, 72 50, 68 62 Z" fill="#042F2E" stroke="#134E4A" stroke-width="2.5" />
      <ellipse cx="86" cy="72" rx="4.5" ry="5.5" fill="#134E4A" />
      <circle cx="87" cy="70" r="1.6" fill="#FFFFFF" />
      <ellipse cx="114" cy="72" rx="4.5" ry="5.5" fill="#134E4A" />
      <circle cx="115" cy="70" r="1.6" fill="#FFFFFF" />
      <path d="M 96 88 Q 100 91 104 88" stroke="#134E4A" stroke-width="2" fill="none" stroke-linecap="round" />
    `;
  } else {
    // 심플 라인
    content = `
      <rect width="200" height="150" fill="#F8FAFC" />
      <circle cx="100" cy="75" r="50" fill="#E2E8F0" opacity="0.6" />
      <path d="M 52 140 C 52 118, 74 108, 100 108 C 126 108, 148 118, 148 140 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="3" />
      <ellipse cx="100" cy="72" rx="32" ry="34" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
      <path d="M 66 65 C 64 42, 85 36, 100 36 C 115 36, 136 42, 134 65 C 130 52, 116 48, 100 48 C 84 48, 70 52, 66 65 Z" fill="#1E293B" stroke="#1E293B" stroke-width="2.5" />
      <circle cx="88" cy="72" r="4" fill="#1E293B" />
      <circle cx="89" cy="71" r="1.4" fill="#FFFFFF" />
      <circle cx="112" cy="72" r="4" fill="#1E293B" />
      <circle cx="113" cy="71" r="1.4" fill="#FFFFFF" />
      <path d="M 94 84 Q 100 88 106 84" stroke="#1E293B" stroke-width="2.5" fill="none" stroke-linecap="round" />
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" width="100%" height="100%">${content}</svg>`.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const STYLE_PRESETS_DATA: StylePresetMeta[] = [
  {
    id: "simple-line",
    name: "심플 라인",
    badge: "일상·공감툰 표준",
    description: "선명한 먹선과 플랫 채색으로 편안하고 직관적인 인스타툰의 정석",
    sampleSvg: generateStyleSampleSvg("심플 라인"),
    imageUrl: "/styles/simple-line.png",
  },
  {
    id: "pastel",
    name: "파스텔",
    badge: "힐링·감성·반려동물",
    description: "부드러운 파스텔 톤과 따스한 색감으로 사랑스러운 분위기 극대화",
    sampleSvg: generateStyleSampleSvg("파스텔"),
    imageUrl: "/styles/pastel.png",
  },
  {
    id: "bold-line",
    name: "굵은 선",
    badge: "팝아트·임팩트·개그",
    description: "두껍고 강렬한 외곽선과 비비드한 명암으로 스크롤을 멈추게 하는 화풍",
    sampleSvg: generateStyleSampleSvg("굵은 선"),
    imageUrl: "/styles/bold-line.png",
  },
  {
    id: "cheerful-comic",
    name: "명랑 코믹",
    badge: "하이텐션·시트콤",
    description: "통통 튀는 원색과 유쾌하고 다이내믹한 표정 연출의 코미디 화풍",
    sampleSvg: generateStyleSampleSvg("명랑 코믹"),
    imageUrl: "/styles/cheerful-comic.png",
  },
  {
    id: "colored-pencil",
    name: "감성 색연필",
    badge: "아날로그·에세이",
    description: "종이 위 손그림의 연필 질감과 은은한 수채화 물맛이 느껴지는 감성 화풍",
    sampleSvg: generateStyleSampleSvg("감성 색연필"),
    imageUrl: "/styles/colored-pencil.png",
  },
  {
    id: "modern-k-webtoon",
    name: "모던 K-웹툰",
    badge: "트렌디·로맨스·드라마",
    description: "날렵하고 세련된 정통 K-웹툰 작화로 캐릭터의 매력과 감정선 표현",
    sampleSvg: generateStyleSampleSvg("모던 K-웹툰"),
    imageUrl: "/styles/modern-k-webtoon.png",
  },
];
