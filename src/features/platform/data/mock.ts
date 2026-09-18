import type {
  Asset,
  AssetKind,
  AttendanceState,
  CreditState,
  PlatformRepository,
  Profile,
  SeriesDetail,

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
  keepSelfieOriginal: false,
};

const ASSETS: Asset[] = [
  {
    id: "as_me",
    kind: "character",
    name: "나 (기본)",
    description: "20대 후반, 곱슬머리, 안경, 회색 후드티. 무표정이 기본.",
    tags: ["안경", "곱슬머리", "후드티"],
    thumbUrl: null,
    usedIn: 4,
    usedInEpisodes: ["1화", "2화", "3화", "4화 초안"],
  },
  {
    id: "as_boss",
    kind: "character",
    name: "부장님",
    description: "50대, 넥타이, 항상 팔짱. 목소리가 크다.",
    tags: ["넥타이", "팔짱"],
    thumbUrl: null,
    usedIn: 3,
    usedInEpisodes: ["1화", "2화", "3화"],
  },
  {
    id: "as_j",
    kind: "character",
    name: "동료 J",
    description: "옆자리 동기. 눈치가 빠르다.",
    tags: ["단발"],
    thumbUrl: null,
    usedIn: 1,
    usedInEpisodes: ["2화"],
  },
  {
    id: "as_meeting",
    kind: "location",
    name: "회의실",
    description: "긴 테이블, 화이트보드, 블라인드.",
    tags: [],
    thumbUrl: null,
    usedIn: 3,
    usedInEpisodes: ["1화", "2화", "3화"],
  },
  {
    id: "as_pantry",
    kind: "location",
    name: "탕비실",
    description: "커피머신과 싱크대.",
    tags: [],
    thumbUrl: null,
    usedIn: 2,
    usedInEpisodes: ["2화", "3화"],
  },
  {
    id: "as_mug",
    kind: "prop",
    name: "머그컵",
    description: "이가 나간 파란 머그.",
    tags: [],
    thumbUrl: null,
    usedIn: 2,
    usedInEpisodes: ["2화", "3화"],
  },
  {
    id: "as_style",
    kind: "style",
    name: "심플 라인",
    description: "얇은 선, 낮은 채도, 흰 배경.",
    tags: [],
    thumbUrl: null,
    usedIn: 4,
    usedInEpisodes: ["1화", "2화", "3화", "4화 초안"],
  },
];

const SERIES: SeriesDetail[] = [
  {
    id: "sr_villain",
    title: "직장 상사 빌런",
    description: "회의실에서 조용히 죽는 중",
    isPublic: false,
    episodeCount: 4,
    updatedAt: "2026-09-16T09:00:00Z",
    rule: {
      stylePreset: "심플 라인",
      defaultCutCount: 6,
      aspectRatio: "4:5",
      tone: "반말 · 자조적",
      fixedHashtags: ["#직장상사빌런", "#샥툰"],
    },
    episodes: [
      { id: "ep_001", number: 1, title: "내 아이디어", status: "published", cutCount: 6, publishedAt: "2026-09-12T10:00:00Z" },
      { id: "ep_002", number: 2, title: "탕비실", status: "published", cutCount: 6, publishedAt: "2026-09-15T10:00:00Z" },
      { id: "ep_003", number: 3, title: "회의록", status: "published", cutCount: 6, publishedAt: "2026-09-17T10:00:00Z" },
      { id: "ep_004", number: 4, title: null, status: "storyboard", cutCount: 6, publishedAt: null },
    ],
    assets: ASSETS.filter((a) => a.id !== "as_j"),
  },
  {
    id: "sr_cat",
    title: "고양이 출근길",
    description: null,
    isPublic: false,
    episodeCount: 1,
    updatedAt: "2026-09-10T09:00:00Z",
    rule: {
      stylePreset: "파스텔",
      defaultCutCount: 4,
      aspectRatio: "1:1",
      tone: "존댓말 · 다정",
      fixedHashtags: ["#고양이출근길"],
    },
    episodes: [
      { id: "ep_101", number: 1, title: null, status: "draft", cutCount: 4, publishedAt: null },
    ],
    assets: [],
  },
];

/** 모듈 수준 상태. 새로고침하면 초기화된다. 목이라 그걸로 충분하다. */
let credit: CreditState = { balance: 11, held: 0 };
let attendance: AttendanceState = { checkedInToday: false, streak: 6 };

export const mockRepository: PlatformRepository = {
  async getProfile() {
    return PROFILE;
  },
  async getCredit() {
    return credit;
  },
  async getAttendance() {
    return attendance;
  },
  async checkIn() {
    if (attendance.checkedInToday) {
      throw new Error("오늘은 이미 출석했습니다");
    }
    const streak = attendance.streak + 1;
    const granted = streak % 7 === 0 ? 4 : 1;
    attendance = { checkedInToday: true, streak };
    credit = { balance: credit.balance + granted, held: credit.held, delta: granted };
    return { streak, granted, balance: credit.balance };
  },
  async listSeries() {
    return SERIES.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      isPublic: s.isPublic,
      episodeCount: s.episodeCount,
      updatedAt: s.updatedAt,
    }));
  },
  async getSeries(id) {
    return SERIES.find((s) => s.id === id) ?? null;
  },
  async listAssets(kind) {
    return kind ? ASSETS.filter((a) => a.kind === kind) : ASSETS;
  },
  async countAssetsByKind() {
    return ASSETS.reduce(
      (acc, a) => ({ ...acc, [a.kind]: acc[a.kind] + 1 }),
      { character: 0, location: 0, prop: 0, style: 0 } as Record<AssetKind, number>,
    );
  },
};
