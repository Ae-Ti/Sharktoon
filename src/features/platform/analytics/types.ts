export interface SnsAccountInfo {
  platform: "instagram";
  username: string;
  displayName: string;
  profilePictureUrl?: string;
  followersCount: number;
  mediaCount: number;
  accountType: "CREATOR" | "BUSINESS";
  connected: boolean;
  lastSyncedAt: string;
}

export interface SnsOverviewMetrics {
  totalReach: number;
  totalReachDelta: number;
  /** 조회수(views). impressions 는 2025-04 에 폐지됐다. */
  totalViews: number;
  avgSaves: number;
  avgSavesDelta: number;
  avgShares: number;
  avgSharesDelta: number;
  engagementRate: number;
  newFollowers: number;
}

export interface SnsTrendDataPoint {
  date: string;
  reach: number;
  saves: number;
  shares: number;
}

export interface SnsEpisodeMetric {
  episodeId: string;
  seriesId: string;
  seriesTitle: string;
  episodeNumber: number;
  title: string;
  thumbnailUrl: string | null;
  instagramPostUrl: string;
  publishedAt: string;
  reach: number;
  saves: number;
  shares: number;
  likes: number;
  comments: number;
  saveRate: number;
  keyInsight: string;
}

export interface SnsInsightRecommendation {
  highlight: string;
  recommendedTheme: string;
  recommendedHook: string;
  bestFormat: string;
}

export interface MediaKitSummary {
  creatorName: string;
  channelName: string;
  category: string;
  primaryAudience: string;
  avgReachPerEpisode: number;
  avgSavesPerEpisode: number;
  standardRate: string;
  contactEmail: string;
  bio: string;
}

export interface SnsAnalyticsData {
  account: SnsAccountInfo;
  overview: SnsOverviewMetrics;
  trends: SnsTrendDataPoint[];
  topEpisodes: SnsEpisodeMetric[];
  recommendation: SnsInsightRecommendation;
  mediaKit: MediaKitSummary;
}

