/** 화면이 쓰는 도메인 타입. DB 행과 1:1 이 아니라 화면에 필요한 모양이다. */

import type { CreditSpendReason } from "@/contracts/credit";
import type { AssetKind, EpisodeStatus, PlanTier } from "@/lib/supabase/database.types";

export type { AssetKind, EpisodeStatus, PlanTier };

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  plan: PlanTier;
  keepSelfieOriginal: boolean;
}

export interface CreditState {
  /** 쓸 수 있는 잔량. 예약분은 빠져 있다. */
  balance: number;
  held: number;
  /** 최근 증감. 획득·소모·환불 직후에만 값이 있다. */
  delta?: number;
}

export interface AttendanceState {
  /** 오늘 이미 받았는지. */
  checkedInToday: boolean;
  streak: number;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  description: string | null;
  tags: string[];
  /** 서명 URL. 없으면 화면이 자리표시자를 그린다. */
  thumbUrl: string | null;
  /** 이 에셋을 참조하는 회차 수. 바꿨을 때의 파급. */
  usedIn: number;
  /** 영향받는 회차 라벨. 상세 패널에서 보여준다. */
  usedInEpisodes: string[];
}

export interface EpisodeSummary {
  id: string;
  number: number;
  title: string | null;
  status: EpisodeStatus;
  cutCount: number;
  publishedAt: string | null;
}

export interface SeriesRule {
  stylePreset: string;
  defaultCutCount: number;
  aspectRatio: "1:1" | "4:5";
  tone: string | null;
  fixedHashtags: string[];
}

export interface SeriesSummary {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  episodeCount: number;
  updatedAt: string;
}

export interface SeriesDetail extends SeriesSummary {
  rule: SeriesRule;
  episodes: EpisodeSummary[];
  assets: Asset[];
}

/**
 * 화면이 의존하는 저장소. Supabase 키가 없으면 목 구현이,
 * 있으면 Supabase 구현이 들어온다. 화면 코드는 어느 쪽인지 모른다.
 */
export interface PlatformRepository {
  getProfile(): Promise<Profile | null>;
  getCredit(): Promise<CreditState>;
  getAttendance(): Promise<AttendanceState>;
  checkIn(): Promise<{ streak: number; granted: number; balance: number }>;
  listSeries(): Promise<SeriesSummary[]>;
  getSeries(id: string): Promise<SeriesDetail | null>;
  listAssets(kind?: AssetKind): Promise<Asset[]>;
  countAssetsByKind(): Promise<Record<AssetKind, number>>;

  createAsset(input: AssetInput): Promise<Asset>;
  updateAsset(id: string, input: AssetInput): Promise<Asset>;
  /** 참조하는 회차가 있으면 막는다. 지난 회차의 일관성을 깨뜨리기 때문이다. */
  deleteAsset(id: string): Promise<void>;

  createSeries(input: SeriesInput): Promise<SeriesSummary>;
  updateSeriesRule(seriesId: string, rule: SeriesRule): Promise<void>;
  setSeriesAssets(seriesId: string, assetIds: string[]): Promise<void>;
  /** 다음 번호로 회차를 하나 연다. 번호는 서버가 정한다. */
  createEpisode(seriesId: string, story: string): Promise<EpisodeSummary>;

  /**
   * 생성 파이프라인이 회차 하나를 만들 때 필요한 것 전부.
   * 콘티·생성 화면(웅싯)이 이걸 읽어 목 데이터를 대신한다.
   */
  getEpisodeContext(episodeId: string): Promise<EpisodeContext | null>;
  /** 온보딩에서 사연을 받아 시리즈와 1화를 연다. 시리즈가 없으면 같이 만든다. */
  startEpisode(input: {
    story: string;
    cutCount: number;
    seriesId?: string;
  }): Promise<{ episodeId: string; seriesId: string }>;

  /** 크레딧 3단. 생성 요청 직전 hold, 성공 commit, 실패 refund. */
  holdCredit(input: {
    amount: number;
    reason: CreditSpendReason;
    jobId: string;
  }): Promise<string>;
  commitCredit(holdId: string): Promise<void>;
  refundCredit(holdId: string, reason: string): Promise<number>;

  /** 운영자 전용. 관리자가 아니면 null 을 돌려준다. */
  getAdminOverview(): Promise<AdminOverview | null>;
}

/** 회차 하나를 생성하는 데 필요한 고정 컨텍스트. */
export interface EpisodeContext {
  episodeId: string;
  seriesId: string;
  seriesTitle: string;
  number: number;
  /** 사용자가 입력한 사연 원문. 콘티 생성의 입력. */
  story: string;
  cutCount: number;
  rule: SeriesRule;
  /** 모든 생성 호출에 고정 레퍼런스로 들어갈 에셋. */
  assets: Asset[];
}

export interface AssetInput {
  kind: AssetKind;
  name: string;
  description: string | null;
  tags: string[];
}

export interface SeriesInput {
  title: string;
  description: string | null;
  rule: SeriesRule;
}

export interface AdminOverview {
  /** 첫 게시 완주 깔때기. 베타의 1차 지표가 이것이다. */
  funnel: { step: string; users: number }[];
  generation: {
    holds: number;
    refunded: number;
    /** 환불된 hold 비율. 생성 실패는 반드시 환불되므로 실패율과 같다. */
    failureRate: number;
  };
  credit: { spent: number; refunded: number; granted: number };
  recentRefunds: {
    id: number;
    userId: string;
    amount: number;
    createdAt: string;
  }[];
}
