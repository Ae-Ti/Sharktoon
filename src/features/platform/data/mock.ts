import { InsufficientCreditError } from "@/contracts/credit";
import { processSingleton } from "@/lib/singleton";
import {
  generateAssetIllustrationSvg,
  STYLE_PRESETS_DATA,
} from "../assets/assetVisuals";
import type {
  CreditPolicy,
  RefundRequest,
  AdminOverview,
  Asset,
  AssetInput,
  AssetKind,
  AttendanceState,
  CreditState,
  PlatformRepository,
  Profile,
  SeriesDetail,
  SeriesInput,
  SeriesRule,
  UserActivityItem,
} from "./types";

/**
 * Supabase 연결 전까지 화면을 돌리는 목 저장소.
 * 값은 와이어프레임에 그려둔 것과 같게 맞췄다.
 */

const PROFILE: Profile = {
  id: "mock-user",
  displayName: "태일",
  avatarUrl: null,
  plan: "free",
};

const SEED_ASSETS: Asset[] = [
  {
    id: "as_me",
    kind: "character",
    name: "나 (기본)",
    description: "20대 후반, 곱슬머리, 안경, 회색 후드티. 무표정이 기본.",
    tags: ["안경", "곱슬머리", "후드티"],
    thumbUrl: generateAssetIllustrationSvg({
      name: "나 (기본)",
      kind: "character",
      description: "20대 후반, 곱슬머리, 안경, 회색 후드티. 무표정이 기본.",
      tags: ["안경", "곱슬머리", "후드티"],
      style: "심플 라인",
    }),
    referenceUrls: [
      generateAssetIllustrationSvg({
        name: "나 (기본)",
        kind: "character",
        description: "20대 후반, 곱슬머리, 안경, 회색 후드티. 무표정이 기본.",
        tags: ["안경", "곱슬머리", "후드티"],
        style: "심플 라인",
      }),
    ],
    usedIn: 4,
    usedInEpisodes: ["1화", "2화", "3화", "4화 초안"],
  },
  {
    id: "as_boss",
    kind: "character",
    name: "부장님",
    description: "50대, 넥타이, 항상 팔짱. 목소리가 크다.",
    tags: ["넥타이", "팔짱"],
    thumbUrl: generateAssetIllustrationSvg({
      name: "부장님",
      kind: "character",
      description: "50대, 넥타이, 항상 팔짱. 목소리가 크다.",
      tags: ["넥타이", "팔짱"],
      style: "심플 라인",
    }),
    referenceUrls: [
      generateAssetIllustrationSvg({
        name: "부장님",
        kind: "character",
        description: "50대, 넥타이, 항상 팔짱. 목소리가 크다.",
        tags: ["넥타이", "팔짱"],
        style: "심플 라인",
      }),
    ],
    usedIn: 3,
    usedInEpisodes: ["1화", "2화", "3화"],
  },
  {
    id: "as_j",
    kind: "character",
    name: "동료 J",
    description: "옆자리 동기. 눈치가 빠르다.",
    tags: ["단발"],
    thumbUrl: generateAssetIllustrationSvg({
      name: "동료 J",
      kind: "character",
      description: "옆자리 동기. 눈치가 빠르다.",
      tags: ["단발"],
      style: "심플 라인",
    }),
    referenceUrls: [
      generateAssetIllustrationSvg({
        name: "동료 J",
        kind: "character",
        description: "옆자리 동기. 눈치가 빠르다.",
        tags: ["단발"],
        style: "심플 라인",
      }),
    ],
    usedIn: 1,
    usedInEpisodes: ["2화"],
  },
  {
    id: "as_meeting",
    kind: "location",
    name: "회의실",
    description: "긴 테이블, 화이트보드, 블라인드.",
    tags: ["회의실", "테이블"],
    thumbUrl: generateAssetIllustrationSvg({
      name: "회의실",
      kind: "location",
      description: "긴 테이블, 화이트보드, 블라인드.",
      tags: ["회의실", "테이블"],
      style: "심플 라인",
    }),
    referenceUrls: [
      generateAssetIllustrationSvg({
        name: "회의실",
        kind: "location",
        description: "긴 테이블, 화이트보드, 블라인드.",
        tags: ["회의실", "테이블"],
        style: "심플 라인",
      }),
    ],
    usedIn: 3,
    usedInEpisodes: ["1화", "2화", "3화"],
  },
  {
    id: "as_pantry",
    kind: "location",
    name: "탕비실",
    description: "커피머신과 싱크대.",
    tags: ["탕비실", "커피"],
    thumbUrl: generateAssetIllustrationSvg({
      name: "탕비실",
      kind: "location",
      description: "커피머신과 싱크대.",
      tags: ["탕비실", "커피"],
      style: "심플 라인",
    }),
    referenceUrls: [
      generateAssetIllustrationSvg({
        name: "탕비실",
        kind: "location",
        description: "커피머신과 싱크대.",
        tags: ["탕비실", "커피"],
        style: "심플 라인",
      }),
    ],
    usedIn: 2,
    usedInEpisodes: ["2화", "3화"],
  },
  {
    id: "as_mug",
    kind: "prop",
    name: "머그컵",
    description: "이가 나간 파란 머그.",
    tags: ["머그컵", "파란"],
    thumbUrl: generateAssetIllustrationSvg({
      name: "머그컵",
      kind: "prop",
      description: "이가 나간 파란 머그.",
      tags: ["머그컵", "파란"],
      style: "심플 라인",
    }),
    referenceUrls: [
      generateAssetIllustrationSvg({
        name: "머그컵",
        kind: "prop",
        description: "이가 나간 파란 머그.",
        tags: ["머그컵", "파란"],
        style: "심플 라인",
      }),
    ],
    usedIn: 2,
    usedInEpisodes: ["2화", "3화"],
  },
  {
    id: "as_cat_maru",
    kind: "character",
    name: "마루 (치즈냥이)",
    description: "주황색 줄무늬 치즈 태비 고양이. 호기심 많고 츄르를 좋아함.",
    tags: ["고양이", "치즈태비", "동물"],
    thumbUrl: generateAssetIllustrationSvg({
      name: "마루 (치즈냥이)",
      kind: "animal",
      description: "주황색 줄무늬 치즈 태비 고양이. 호기심 많고 츄르를 좋아함.",
      tags: ["고양이", "치즈태비", "동물"],
      style: "파스텔",
    }),
    referenceUrls: [
      generateAssetIllustrationSvg({
        name: "마루 (치즈냥이)",
        kind: "animal",
        description: "주황색 줄무늬 치즈 태비 고양이. 호기심 많고 츄르를 좋아함.",
        tags: ["고양이", "치즈태비", "동물"],
        style: "파스텔",
      }),
    ],
    usedIn: 1,
    usedInEpisodes: ["1화 초안"],
  },
  {
    id: "as_cat_home",
    kind: "location",
    name: "원룸 거실 & 캣타워",
    description: "창가 햇살이 드는 아늑한 원룸 거실과 캣타워.",
    tags: ["원룸", "캣타워"],
    thumbUrl: generateAssetIllustrationSvg({
      name: "원룸 거실 & 캣타워",
      kind: "location",
      description: "창가 햇살이 드는 아늑한 원룸 거실과 캣타워.",
      tags: ["원룸", "캣타워"],
      style: "파스텔",
    }),
    referenceUrls: [
      generateAssetIllustrationSvg({
        name: "원룸 거실 & 캣타워",
        kind: "location",
        description: "창가 햇살이 드는 아늑한 원룸 거실과 캣타워.",
        tags: ["원룸", "캣타워"],
        style: "파스텔",
      }),
    ],
    usedIn: 1,
    usedInEpisodes: ["1화 초안"],
  },
  {
    id: "as_style",
    kind: "style",
    name: "심플 라인",
    description: "얇은 선, 낮은 채도, 흰 배경.",
    tags: [],
    thumbUrl: null,
    referenceUrls: [],
    usedIn: 4,
    usedInEpisodes: ["1화", "2화", "3화", "4화 초안"],
  },
];

function getSeriesFallbackThumb(rule?: SeriesRule | null): string {
  if (rule?.customStyleImageUrl) return rule.customStyleImageUrl;
  const match = STYLE_PRESETS_DATA.find((p) => p.name === rule?.stylePreset);
  return match?.imageUrl || "/styles/simple-line.png";
}

const SEED_SERIES: (SeriesDetail & { thumbUrl?: string | null })[] = [
  {
    id: "sr_villain",
    title: "직장 상사 빌런",
    description: "회의실에서 조용히 죽는 중",
    isPublic: false,
    episodeCount: 4,
    updatedAt: "2026-09-18T09:00:00Z",
    thumbUrl: "/benchmark/episodes/1_sunburst_cut_1.png",
    rule: {
      stylePreset: "심플 라인",
      defaultCutCount: 6,
      aspectRatio: "1:1",
      tone: "반말 · 자조적",
      fixedHashtags: ["#직장상사빌런", "#샥툰"],
    },
    episodes: [
      { id: "ep_001", number: 1, title: "내 아이디어", status: "published", cutCount: 6, publishedAt: "2026-09-12T10:00:00Z", thumbUrl: "/benchmark/episodes/1_sunburst_cut_1.png" },
      { id: "ep_002", number: 2, title: "탕비실", status: "published", cutCount: 6, publishedAt: "2026-09-15T10:00:00Z", thumbUrl: "/benchmark/episodes/1_sunburst_cut_2.png" },
      { id: "ep_003", number: 3, title: "회의록", status: "published", cutCount: 6, publishedAt: "2026-09-17T10:00:00Z", thumbUrl: "/benchmark/episodes/1_sunburst_cut_3.png" },
      { id: "ep_004", number: 4, title: null, status: "storyboard", cutCount: 6, publishedAt: null, thumbUrl: "/benchmark/episodes/1_sunburst_cut_4.png" },
    ],
    assets: SEED_ASSETS.filter((a) => a.id !== "as_j" && a.id !== "as_cat_maru" && a.id !== "as_cat_home"),
  },
  {
    id: "sr_cat",
    title: "고양이 출근길",
    description: "현관을 사수하는 치즈 태비 냥이와의 매일 아침 출근 실랑이",
    isPublic: true,
    episodeCount: 2,
    updatedAt: "2026-09-15T09:00:00Z",
    thumbUrl: "/benchmark/episodes/2_flare_cut_1.png",
    rule: {
      stylePreset: "파스텔",
      defaultCutCount: 4,
      aspectRatio: "1:1",
      tone: "존댓말 · 다정",
      fixedHashtags: ["#고양이출근길", "#냥스타그램"],
    },
    episodes: [
      { id: "ep_101", number: 1, title: "현관 앞의 수문장", status: "published", cutCount: 4, publishedAt: "2026-09-10T09:00:00Z", thumbUrl: "/benchmark/episodes/2_flare_cut_1.png" },
      { id: "ep_102", number: 2, title: "츄르로 유혹하기", status: "draft", cutCount: 4, publishedAt: null, thumbUrl: "/benchmark/episodes/2_flare_cut_2.png" },
    ],
    assets: SEED_ASSETS.filter((a) => a.id === "as_cat_maru" || a.id === "as_cat_home"),
  },
  {
    id: "sr_dev",
    title: "개발자 생존기",
    description: "배포 10분 전 터진 버그와 슬랙 알림의 공포 실화",
    isPublic: true,
    episodeCount: 3,
    updatedAt: "2026-09-10T09:00:00Z",
    thumbUrl: "/benchmark/episodes/3_fal_dev_cut_1.jpg",
    rule: {
      stylePreset: "모던 K-웹툰",
      defaultCutCount: 4,
      aspectRatio: "1:1",
      tone: "반말 · 유머",
      fixedHashtags: ["#개발자생존기", "#코딩툰", "#샥툰"],
    },
    episodes: [
      { id: "ep_201", number: 1, title: "금요일 배포의 저주", status: "published", cutCount: 4, publishedAt: "2026-09-05T10:00:00Z", thumbUrl: "/benchmark/episodes/3_fal_dev_cut_1.jpg" },
      { id: "ep_202", number: 2, title: "슬랙 멘션 알림음", status: "published", cutCount: 4, publishedAt: "2026-09-08T10:00:00Z", thumbUrl: "/benchmark/episodes/3_fal_dev_cut_2.jpg" },
      { id: "ep_203", number: 3, title: "핫픽스 롤백", status: "published", cutCount: 4, publishedAt: "2026-09-10T10:00:00Z", thumbUrl: "/benchmark/episodes/3_fal_dev_cut_3.jpg" },
    ],
    assets: SEED_ASSETS.filter((a) => a.id === "as_me" || a.id === "as_mug"),
  },
];

/**
 * Date.now() 로 id 를 만들면 같은 밀리초에 두 개를 만들 때 충돌한다.
 * 실제로 1화와 2화가 같은 id 를 받아 앞 회차의 사연이 덮어써졌다.
 */
function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

const MOCK_POLICY: CreditPolicy = {
  signupBonus: 8,
  attendanceDaily: 1, // 매일 1크레딧
  attendanceStreakDays: 7,
  attendanceStreakBonus: 1, // 7일 연속 출석 시 +1크레딧 (당일 총 2크레딧, 인하)
  attendanceMonthlyCap: 9999, // 상한 제한 없음
  refundFeeRate: 0.1,
};

const DEFAULT_RULE: SeriesRule = {
  stylePreset: "심플 라인",
  defaultCutCount: 6,
  aspectRatio: "1:1",
  tone: null,
  fixedHashtags: [],
};

function createSeedActivities(attendance?: AttendanceState): UserActivityItem[] {
  const items: UserActivityItem[] = [];
  const now = new Date();

  const getDateStr = (daysAgo: number) => {
    const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  };

  // Recent days of attendance
  if (attendance?.checkedInToday) {
    items.push({
      id: "act_att_0",
      date: getDateStr(0),
      type: "attendance",
      title: `연속 ${attendance.streak}일 출석 달성`,
      description: attendance.streak % 7 === 0 ? "7일 연속 보너스 지급!" : "매일 출석 보너스",
      creditDelta: attendance.streak % 7 === 0 ? 3 : 1,
      time: "09:30",
      createdAt: now.toISOString(),
    });
  }

  for (let i = 1; i <= 6; i++) {
    items.push({
      id: `act_att_${i}`,
      date: getDateStr(i),
      type: "attendance",
      title: `연속 ${7 - i}일 출석 체크 완료`,
      description: "매일 출석 보너스",
      creditDelta: 1,
      time: "09:15",
      createdAt: new Date(now.getTime() - i * 86400000 + 3600000).toISOString(),
    });
  }

  // Episode generation and creation events
  items.push(
    {
      id: "act_gen_1",
      date: getDateStr(1),
      type: "generation",
      title: "1화 컷 이미지 4개 생성",
      description: "고양이의 보은 1화 컷 생성 완료",
      creditDelta: -4,
      time: "14:20",
      createdAt: new Date(now.getTime() - 1 * 86400000 + 7200000).toISOString(),
    },
    {
      id: "act_pub_1",
      date: getDateStr(1),
      type: "publish",
      title: "1화 인스타툰 완성 및 발행",
      description: "고양이의 보은 1화 발행 완료",
      creditDelta: null,
      time: "15:45",
      createdAt: new Date(now.getTime() - 1 * 86400000 + 10800000).toISOString(),
    },
    {
      id: "act_asset_1",
      date: getDateStr(3),
      type: "series",
      title: "캐릭터 소재 등록",
      description: "'나 (기본)' 캐릭터 시트 등록",
      creditDelta: null,
      time: "11:30",
      createdAt: new Date(now.getTime() - 3 * 86400000 + 7200000).toISOString(),
    },
    {
      id: "act_gen_2",
      date: getDateStr(3),
      type: "generation",
      title: "2컷 테스트 이미지 생성",
      description: "스타일 테스트 생성",
      creditDelta: -2,
      time: "16:10",
      createdAt: new Date(now.getTime() - 3 * 86400000 + 14400000).toISOString(),
    },
    {
      id: "act_series_1",
      date: getDateStr(5),
      type: "series",
      title: "신규 시리즈 '고양이의 보은' 생성",
      description: "인스타툰 새 연재작 개설",
      creditDelta: null,
      time: "10:05",
      createdAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
    },
    {
      id: "act_signup_1",
      date: getDateStr(6),
      type: "credit",
      title: "회원가입 웰컴 크레딧 지급",
      description: "신규 가입 환영 무상 크레딧",
      creditDelta: 100,
      time: "09:00",
      createdAt: new Date(now.getTime() - 6 * 86400000).toISOString(),
    }
  );

  // Past scattered creative & attendance history over last 12 weeks
  const pastDays = [9, 10, 11, 12, 13, 14, 18, 19, 20, 25, 26, 27, 33, 34, 35, 41, 42, 48, 49, 55, 56, 62, 63, 70, 71, 77, 84, 85, 92, 98, 105];
  for (const d of pastDays) {
    items.push({
      id: `act_past_${d}`,
      date: getDateStr(d),
      type: "attendance",
      title: "출석 체크 완료",
      description: "매일 출석 보너스",
      creditDelta: 1,
      time: "10:20",
      createdAt: new Date(now.getTime() - d * 86400000).toISOString(),
    });
    if (d % 3 === 0) {
      items.push({
        id: `act_past_gen_${d}`,
        date: getDateStr(d),
        type: "generation",
        title: "컷 이미지 생성",
        description: "웹툰 컷 생성 완료",
        creditDelta: -4,
        time: "16:40",
        createdAt: new Date(now.getTime() - d * 86400000 + 18000000).toISOString(),
      });
    }
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * 목 상태. 새로고침하면 초기화된다. 목이라 그걸로 충분하다.
 *
 * 모듈 변수에 두면 dev 에서 서버 액션과 라우트 핸들러가 서로 다른 사본을 본다
 * (한쪽에서 쓴 크레딧이 다른 쪽에선 그대로). 그래서 프로세스 전역에 하나만 둔다.
 */
const S = processSingleton("platform-mock", () => {
  const assets = structuredClone(SEED_ASSETS);
  // 시리즈의 에셋은 라이브러리 배열의 원소를 그대로 가리켜야 수정이 따라간다.
  const series: SeriesDetail[] = SEED_SERIES.map((s) => ({
    ...structuredClone(s),
    assets: assets.filter((a) => s.assets.some((x) => x.id === a.id)),
  }));
  return {
    assets,
    series,
    credit: { balance: 100, held: 0 } as CreditState,
    stories: {
      ep_001: "어제 부장님이 회의 중에 내 아이디어를 자기 것처럼 말했다",
    } as Record<string, string>,
    holds: new Map<string, { amount: number; reason: string; jobId: string; status: string }>(),
    attendance: { checkedInToday: false, streak: 6 } as AttendanceState,
    attendanceThisMonth: 0,
    /** 목에서 결제는 운영자 수동 지급만 흉내낸다. */
    purchased: { credits: 0, krw: 0 },
    refunds: [] as RefundRequest[],
    deletionRequestedAt: null as string | null,
    activities: createSeedActivities(),
  };
});

export const mockRepository: PlatformRepository = {
  async currentUserId() {
    return PROFILE.id;
  },
  async getProfile() {
    return PROFILE;
  },
  async updatePlan(plan) {
    PROFILE.plan = plan;
    const bonus = plan === "max" ? 1000 : plan === "pro" ? 350 : 0;
    if (bonus > 0) {
      S.credit = {
        balance: S.credit.balance + bonus,
        held: S.credit.held,
        delta: bonus,
      };
      if (!S.activities) S.activities = createSeedActivities(S.attendance);
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      S.activities.unshift({
        id: `act_sub_${Date.now()}`,
        date: today,
        type: "credit",
        title: `${plan === "max" ? "Max" : "Pro"} 멤버십 구독 시작`,
        description: `월간 구독 크레딧 +${bonus}C 정기 지급`,
        creditDelta: bonus,
        time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        createdAt: new Date().toISOString(),
      });
    }
    return PROFILE;
  },
  async purchaseCredits(credits: number, krw: number) {
    S.purchased = {
      credits: S.purchased.credits + credits,
      krw: S.purchased.krw + krw,
    };
    S.credit = {
      balance: S.credit.balance + credits,
      held: S.credit.held,
      delta: credits,
    };
    if (!S.activities) S.activities = createSeedActivities(S.attendance);
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    S.activities.unshift({
      id: `act_purchase_${Date.now()}`,
      date: today,
      type: "credit",
      title: `크레딧 단품 팩 충전 (+${credits}C)`,
      description: `₩${krw.toLocaleString("ko-KR")} 결제 완료 (5년 유효)`,
      creditDelta: credits,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
    });
    return { balance: S.credit.balance };
  },
  async getCredit() {
    // delta 는 변화 직후 한 번만 보여준다. 계속 붙어 있으면 잔량과 헷갈린다.
    const snapshot = S.credit;
    if (S.credit.delta !== undefined) {
      S.credit = { balance: S.credit.balance, held: S.credit.held };
    }
    return snapshot;
  },
  async getAttendance() {
    return S.attendance;
  },
  async checkIn() {
    if (S.attendance.checkedInToday) {
      throw new Error("오늘은 이미 출석했습니다");
    }
    const streak = S.attendance.streak + 1;
    // 하루 1크레딧, 7일 연속 출석 시 1크레딧 보너스 (당일 총 2크레딧, 한 달 상한 없음)
    const p = MOCK_POLICY;
    const daily = p.attendanceDaily;
    let bonus = 0;
    if (streak % p.attendanceStreakDays === 0) {
      bonus = p.attendanceStreakBonus;
    }
    const granted = daily + bonus;
    S.attendanceThisMonth += granted;
    S.attendance = { checkedInToday: true, streak };
    S.credit = { balance: S.credit.balance + granted, held: S.credit.held, delta: granted };

    const now = new Date();
    const today = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const nowTime = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    if (!S.activities) {
      S.activities = createSeedActivities(S.attendance);
    }
    S.activities.unshift({
      id: `act_checkin_${Date.now()}`,
      date: today,
      type: "attendance",
      title: streak % p.attendanceStreakDays === 0
        ? `연속 ${streak}일 출석 달성 (+${granted}C)`
        : `출석 체크 완료 (+${granted}C)`,
      description: streak % p.attendanceStreakDays === 0 ? "7일 연속 보너스 +1C 지급!" : "매일 출석 보너스",
      creditDelta: granted,
      time: nowTime,
      createdAt: now.toISOString(),
    });

    return { streak, granted, balance: S.credit.balance };
  },
  async getActivityLogs() {
    if (!S.activities || S.activities.length === 0) {
      S.activities = createSeedActivities(S.attendance);
    }
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    if (S.attendance.checkedInToday && !S.activities.some((a) => a.date === today && a.type === "attendance")) {
      S.activities.unshift({
        id: `act_att_today_${Date.now()}`,
        date: today,
        type: "attendance",
        title: `연속 ${S.attendance.streak}일 출석 달성`,
        description: S.attendance.streak % 7 === 0 ? "7일 연속 보너스 지급!" : "매일 출석 보너스",
        creditDelta: S.attendance.streak % 7 === 0 ? 3 : 1,
        time: "09:30",
        createdAt: new Date().toISOString(),
      });
    }
    return S.activities;
  },
  async listSeries() {
    return S.series.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      isPublic: s.isPublic,
      episodeCount: s.episodeCount,
      updatedAt: s.updatedAt,
      thumbUrl: s.thumbUrl || s.episodes?.find((e) => e.thumbUrl)?.thumbUrl || getSeriesFallbackThumb(s.rule),
    }));
  },
  async getSeries(id) {
    return S.series.find((s) => s.id === id) ?? null;
  },
  async listAssets(kind) {
    return kind ? S.assets.filter((a) => a.kind === kind) : S.assets;
  },
  async createAsset(input: AssetInput) {
    const thumb = input.thumbUrl || generateAssetIllustrationSvg({
      name: input.name,
      kind: input.kind,
      description: input.description,
      tags: input.tags,
    });
    const asset: Asset = {
      id: newId("as"),
      ...input,
      thumbUrl: thumb,
      referenceUrls: thumb ? [thumb] : [],
      usedIn: 0,
      usedInEpisodes: [],
    };
    S.assets.push(asset);
    return asset;
  },

  async updateAsset(id, input) {
    const i = S.assets.findIndex((a) => a.id === id);
    if (i < 0) throw new Error("없는 에셋이에요");
    const updated = { ...S.assets[i], ...input };
    if (input.thumbUrl) {
      updated.thumbUrl = input.thumbUrl;
      if (!updated.referenceUrls.includes(input.thumbUrl)) {
        updated.referenceUrls = [input.thumbUrl, ...updated.referenceUrls];
      }
    } else if (!updated.thumbUrl) {
      updated.thumbUrl = generateAssetIllustrationSvg({
        name: updated.name,
        kind: updated.kind,
        description: updated.description,
        tags: updated.tags,
      });
      if (updated.referenceUrls.length === 0) {
        updated.referenceUrls = [updated.thumbUrl];
      }
    }
    S.assets[i] = updated;
    return S.assets[i];
  },

  async deleteAsset(id) {
    const a = S.assets.find((x) => x.id === id);
    if (!a) throw new Error("없는 에셋이에요");
    if (a.usedIn > 0) {
      throw new Error(
        `${a.usedIn}개 회차가 이 에셋을 쓰고 있어요. 먼저 회차에서 빼 주세요.`,
      );
    }
    S.assets.splice(S.assets.indexOf(a), 1);
  },

  async setAssetReferences(assetId: string, refs: string[]) {
    const a = S.assets.find((x) => x.id === assetId);
    if (!a) throw new Error("없는 에셋이에요");
    // 목에는 Storage 가 없으므로 ref 가 곧 data URI 다.
    a.referenceUrls = refs;
    a.thumbUrl = refs[0] ?? null;
  },

  async addAssetReference(assetId: string, ref: string) {
    const a = S.assets.find((x) => x.id === assetId);
    if (!a) throw new Error("없는 에셋이에요");
    a.referenceUrls = [ref, ...a.referenceUrls].slice(0, 8);
    a.thumbUrl = ref;
  },

  async recordAssetReferences(episodeId: string, assetIds: string[]) {
    const label = (() => {
      for (const s of S.series) {
        const ep = s.episodes.find((e) => e.id === episodeId);
        if (ep) return ep.status === "published" ? `${ep.number}화` : `${ep.number}화 초안`;
      }
      return null;
    })();
    if (!label) return;
    for (const a of S.assets) {
      if (!assetIds.includes(a.id) || a.usedInEpisodes.includes(label)) continue;
      a.usedInEpisodes = [...a.usedInEpisodes, label];
      a.usedIn = a.usedInEpisodes.length;
    }
  },

  async createSeries(input: SeriesInput) {
    // 화풍 이미지는 저장하지 않는다. 저장해 두면 회차 컷 썸네일보다 먼저 잡혀 계속 화풍 이미지가 보인다.
    const thumbUrl = getSeriesFallbackThumb(input.rule);
    const series: SeriesDetail = {
      id: newId("sr"),
      title: input.title,
      description: input.description,
      isPublic: false,
      episodeCount: 0,
      updatedAt: new Date().toISOString(),
      thumbUrl: null,
      rule: input.rule,
      episodes: [],
      assets: [],
    };
    S.series.unshift(series);
    return {
      id: series.id,
      title: series.title,
      description: series.description,
      isPublic: series.isPublic,
      episodeCount: 0,
      updatedAt: series.updatedAt,
      thumbUrl,
    };
  },

  async updateSeriesRule(seriesId: string, rule: SeriesRule) {
    const s = S.series.find((x) => x.id === seriesId);
    if (!s) throw new Error("없는 시리즈예요");
    s.rule = rule;
    s.updatedAt = new Date().toISOString();
  },

  async setSeriesAssets(seriesId: string, assetIds: string[]) {
    const s = S.series.find((x) => x.id === seriesId);
    if (!s) throw new Error("없는 시리즈예요");
    s.assets = S.assets.filter((a) => assetIds.includes(a.id));
  },

  async createEpisode(seriesId: string, story: string) {
    const s = S.series.find((x) => x.id === seriesId);
    if (!s) throw new Error("없는 시리즈예요");
    const number = Math.max(0, ...s.episodes.map((e) => e.number)) + 1;
    const ep = {
      id: newId("ep"),
      number,
      title: story.slice(0, 20) || null,
      status: "draft" as const,
      cutCount: s.rule.defaultCutCount,
      publishedAt: null,
    };
    s.episodes.push(ep);
    s.episodeCount = s.episodes.length;

    return ep;
  },

  async updateEpisode(episodeId: string, input: { story?: string; cutCount?: number; seriesId?: string }) {
    for (const s of S.series) {
      const epIndex = s.episodes.findIndex((e) => e.id === episodeId);
      if (epIndex === -1) continue;
      const ep = s.episodes[epIndex];

      if (input.story !== undefined) {
        S.stories[ep.id] = input.story;
        ep.title = input.story.slice(0, 20) || null;
      }
      if (input.cutCount !== undefined) {
        ep.cutCount = input.cutCount;
      }
      if (input.seriesId && input.seriesId !== s.id) {
        s.episodes.splice(epIndex, 1);
        s.episodeCount = s.episodes.length;
        const targetSeries = S.series.find((x) => x.id === input.seriesId);
        if (targetSeries) {
          targetSeries.episodes.push(ep);
          targetSeries.episodeCount = targetSeries.episodes.length;
        }
      }
      return;
    }
  },

  async getResumable() {
    for (const s of S.series) {
      const ep = [...s.episodes]
        .reverse()
        .find((e) => e.status !== "published");
      if (ep) {
        return {
          seriesId: s.id,
          seriesTitle: s.title,
          episodeId: ep.id,
          number: ep.number,
          status: ep.status,
          cutCount: ep.cutCount,
          thumbUrl: ep.thumbUrl || s.thumbUrl || getSeriesFallbackThumb(s.rule),
        };
      }
    }
    return null;
  },

  async getEpisodeContext(episodeId: string) {
    for (const s of S.series) {
      const ep = s.episodes.find((e) => e.id === episodeId);
      if (!ep) continue;
      return {
        episodeId: ep.id,
        seriesId: s.id,
        seriesTitle: s.title,
        number: ep.number,
        story: S.stories[ep.id] ?? "",
        cutCount: ep.cutCount,
        rule: s.rule,
        assets: s.assets,
      };
    }
    return null;
  },

  async startEpisode({ story, cutCount, seriesId, stylePreset, characterAssetId }) {
    // 온보딩에서는 아직 시리즈가 없다. 첫 화를 담을 곳을 같이 만든다.
    let series = seriesId
      ? S.series.find((s) => s.id === seriesId)
      : S.series.find((s) => s.episodes.length === 0);

    if (!series) {
      const rule = {
        ...DEFAULT_RULE,
        defaultCutCount: cutCount,
        stylePreset: stylePreset ?? DEFAULT_RULE.stylePreset,
      };
      series = {
        id: newId("sr"),
        title: story.slice(0, 12) || "새 시리즈",
        description: null,
        isPublic: false,
        episodeCount: 0,
        updatedAt: new Date().toISOString(),
        thumbUrl: null,
        rule,
        episodes: [],
        assets: S.assets.filter((a) => a.id === characterAssetId),
      };
      S.series.unshift(series);
    }
    const character = S.assets.find((a) => a.id === characterAssetId);
    if (character && !series.assets.includes(character)) series.assets.push(character);

    const number = Math.max(0, ...series.episodes.map((e) => e.number)) + 1;
    const ep = {
      id: newId("ep"),
      number,
      title: null,
      status: "storyboard" as const,
      cutCount,
      publishedAt: null,
    };
    series.episodes.push(ep);
    series.episodeCount = series.episodes.length;
    S.stories[ep.id] = story;

    return { episodeId: ep.id, seriesId: series.id };
  },

  async holdCredit({ amount, reason, jobId }) {
    if (S.credit.balance < amount) {
      throw new InsufficientCreditError(amount, S.credit.balance);
    }
    const id = newId("hold");
    S.holds.set(id, { amount, reason, jobId, status: "held" });
    S.credit = {
      balance: S.credit.balance - amount,
      held: S.credit.held + amount,
      delta: -amount,
    };
    return id;
  },

  async commitCredit(holdId: string) {
    const h = S.holds.get(holdId);
    if (!h || h.status !== "held") throw new Error("이미 정산된 hold 예요");
    h.status = "committed";
    S.credit = { ...S.credit, held: S.credit.held - h.amount, delta: undefined };
  },

  async refundCredit(holdId: string) {
    const h = S.holds.get(holdId);
    if (!h || h.status !== "held") throw new Error("이미 정산된 hold 예요");
    h.status = "refunded";
    S.credit = {
      balance: S.credit.balance + h.amount,
      held: S.credit.held - h.amount,
      delta: h.amount,
    };
    return h.amount;
  },

  async getAdminOverview(): Promise<AdminOverview | null> {
    // 목에서는 운영자라고 치고 그럴듯한 수를 보여준다.
    return {
      funnel: [
        { step: "가입", users: 50 },
        { step: "캐릭터 만듦", users: 41 },
        { step: "사연 입력", users: 33 },
        { step: "첫 화 완성", users: 26 },
        { step: "첫 게시", users: 21 },
      ],
      generation: { holds: 184, refunded: 5, failureRate: 5 / 184 },
      credit: { spent: 612, refunded: 5, granted: 740 },
      recentRefunds: [
        { id: 3, userId: "mock-user", amount: 1, createdAt: "2026-09-18T05:10:00Z" },
        { id: 2, userId: "mock-user-2", amount: 6, createdAt: "2026-09-18T03:40:00Z" },
      ],
    };
  },

  async countAssetsByKind() {
    return S.assets.reduce(
      (acc, a) => ({ ...acc, [a.kind]: acc[a.kind] + 1 }),
      { character: 0, location: 0, prop: 0, style: 0 } as Record<AssetKind, number>,
    );
  },

  async getCreditDetail() {
    const purchase = Math.min(S.purchased.credits, S.credit.balance);
    return {
      balance: S.credit.balance,
      held: S.credit.held,
      byKind: { free: S.credit.balance - purchase, subscription: 0, purchase },
      nextExpiry: null,
    };
  },

  async getCreditPolicy() {
    return MOCK_POLICY;
  },

  async getRefundQuote() {
    const credits = Math.min(S.purchased.credits, S.credit.balance);
    const unit = S.purchased.credits ? S.purchased.krw / S.purchased.credits : 0;
    const gross = Math.floor(credits * unit);
    const fee = Math.floor(gross * MOCK_POLICY.refundFeeRate);
    return { credits, grossKrw: gross, feeKrw: fee, netKrw: gross - fee };
  },

  async getMyRefundRequest() {
    return S.refunds.at(-1) ?? null;
  },

  async requestRefund(reason) {
    if (S.refunds.some((r) => r.status === "requested")) throw new Error("이미 처리 중인 환불 신청이 있습니다");
    const q = await mockRepository.getRefundQuote();
    if (q.netKrw <= 0) throw new Error("환불할 유료 크레딧이 없습니다");
    S.refunds.push({
      id: newId("rf"),
      userId: PROFILE.id,
      credits: q.credits,
      netKrw: q.netKrw,
      feeKrw: q.feeKrw,
      reason,
      status: "requested",
      createdAt: new Date().toISOString(),
    });
  },

  async getAccountStatus() {
    const at = S.deletionRequestedAt;
    return {
      deletionRequestedAt: at,
      purgeAt: at ? new Date(Date.parse(at) + 30 * 86_400_000).toISOString() : null,
    };
  },

  async requestAccountDeletion() {
    S.deletionRequestedAt ??= new Date().toISOString();
    return mockRepository.getAccountStatus();
  },

  async cancelAccountDeletion() {
    S.deletionRequestedAt = null;
  },

  async listRefundRequests() {
    return [...S.refunds].reverse();
  },

  async processRefund(id, approve) {
    const r = S.refunds.find((x) => x.id === id && x.status === "requested");
    if (!r) throw new Error("처리할 환불 신청이 없습니다");
    r.status = approve ? "approved" : "rejected";
    if (approve) {
      S.credit = { ...S.credit, balance: S.credit.balance - r.credits };
      S.purchased = { credits: 0, krw: 0 };
    }
  },

  async grantPurchase({ credits, amountKrw }) {
    S.purchased = { credits: S.purchased.credits + credits, krw: S.purchased.krw + amountKrw };
    S.credit = { ...S.credit, balance: S.credit.balance + credits, delta: credits };
  },
};
