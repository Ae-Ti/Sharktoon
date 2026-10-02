import { InsufficientCreditError } from "@/contracts/credit";
import { processSingleton } from "@/lib/singleton";
import type {
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

const SEED_ASSETS: Asset[] = [
  {
    id: "as_me",
    kind: "character",
    name: "나 (기본)",
    description: "20대 후반, 곱슬머리, 안경, 회색 후드티. 무표정이 기본.",
    tags: ["안경", "곱슬머리", "후드티"],
    thumbUrl: null,
    referenceUrls: [],
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
    referenceUrls: [],
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
    referenceUrls: [],
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
    referenceUrls: [],
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
    referenceUrls: [],
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
    referenceUrls: [],
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
    referenceUrls: [],
    usedIn: 4,
    usedInEpisodes: ["1화", "2화", "3화", "4화 초안"],
  },
];

const SEED_SERIES: SeriesDetail[] = [
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
    assets: SEED_ASSETS.filter((a) => a.id !== "as_j"),
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

/**
 * Date.now() 로 id 를 만들면 같은 밀리초에 두 개를 만들 때 충돌한다.
 * 실제로 1화와 2화가 같은 id 를 받아 앞 회차의 사연이 덮어써졌다.
 */
function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

const DEFAULT_RULE: SeriesRule = {
  stylePreset: "심플 라인",
  defaultCutCount: 6,
  aspectRatio: "4:5",
  tone: null,
  fixedHashtags: [],
};

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
    credit: { balance: 11, held: 0 } as CreditState,
    stories: {
      ep_001: "어제 부장님이 회의 중에 내 아이디어를 자기 것처럼 말했다",
    } as Record<string, string>,
    holds: new Map<string, { amount: number; reason: string; jobId: string; status: string }>(),
    attendance: { checkedInToday: false, streak: 6 } as AttendanceState,
  };
});

export const mockRepository: PlatformRepository = {
  async currentUserId() {
    return PROFILE.id;
  },
  async getProfile() {
    return PROFILE;
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
    const granted = streak % 7 === 0 ? 4 : 1;
    S.attendance = { checkedInToday: true, streak };
    S.credit = { balance: S.credit.balance + granted, held: S.credit.held, delta: granted };
    return { streak, granted, balance: S.credit.balance };
  },
  async listSeries() {
    return S.series.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      isPublic: s.isPublic,
      episodeCount: s.episodeCount,
      updatedAt: s.updatedAt,
    }));
  },
  async getSeries(id) {
    return S.series.find((s) => s.id === id) ?? null;
  },
  async listAssets(kind) {
    return kind ? S.assets.filter((a) => a.kind === kind) : S.assets;
  },
  async createAsset(input: AssetInput) {
    const asset: Asset = {
      id: newId("as"),
      ...input,
      thumbUrl: null,
    referenceUrls: [],
      usedIn: 0,
      usedInEpisodes: [],
    };
    S.assets.push(asset);
    return asset;
  },

  async updateAsset(id, input) {
    const i = S.assets.findIndex((a) => a.id === id);
    if (i < 0) throw new Error("없는 에셋이에요");
    S.assets[i] = { ...S.assets[i], ...input };
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
    const series: SeriesDetail = {
      id: newId("sr"),
      title: input.title,
      description: input.description,
      isPublic: false,
      episodeCount: 0,
      updatedAt: new Date().toISOString(),
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
      series = {
        id: newId("sr"),
        title: story.slice(0, 12) || "새 시리즈",
        description: null,
        isPublic: false,
        episodeCount: 0,
        updatedAt: new Date().toISOString(),
        rule: {
          ...DEFAULT_RULE,
          defaultCutCount: cutCount,
          stylePreset: stylePreset ?? DEFAULT_RULE.stylePreset,
        },
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

  async refundOpenHolds(jobId: string) {
    let total = 0;
    for (const [id, h] of S.holds) {
      if (h.jobId === jobId && h.status === "held") total += await this.refundCredit(id, "");
    }
    return total;
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
};
