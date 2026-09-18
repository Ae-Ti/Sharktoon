/** 화면이 쓰는 도메인 타입. DB 행과 1:1 이 아니라 화면에 필요한 모양이다. */

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
}
