import type { EpisodeStatus, SeriesRule } from "../data/types";
import type { SnsAnalyticsData, SnsEpisodeMetric } from "./types";

export interface SeriesSnsSummary {
  connected: boolean;
  username: string;
  totalReach: number;
  totalSaves: number;
  totalShares: number;
  totalLikes: number;
  avgEngagementRate: number;
  publishedCount: number;
  topEpisode: SnsEpisodeMetric | null;
  episodeMetrics: Record<string, SnsEpisodeMetric>;
  aiRecommendation: {
    title: string;
    description: string;
    badge: string;
  };
}

export function formatCompactNumber(num: number): string {
  if (num >= 10000) {
    const val = num / 10000;
    return val >= 10 ? `${Math.round(val)}만` : `${val.toFixed(1)}만`;
  }
  if (num >= 1000) {
    const val = num / 1000;
    return val >= 10 ? `${Math.round(val)}천` : `${val.toFixed(1)}천`;
  }
  return num.toLocaleString("ko-KR");
}

export function getSeriesSnsMetrics(
  series: { id: string; title: string; rule?: SeriesRule },
  episodes: { id: string; number: number; title: string | null; status: EpisodeStatus }[],
  snsData: SnsAnalyticsData
): SeriesSnsSummary {
  const connected = Boolean(snsData.account?.connected);
  const username = snsData.account?.username || "sharktoon_daily";

  if (!connected) {
    return {
      connected: false,
      username,
      totalReach: 0,
      totalSaves: 0,
      totalShares: 0,
      totalLikes: 0,
      avgEngagementRate: 0,
      publishedCount: 0,
      topEpisode: null,
      episodeMetrics: {},
      aiRecommendation: {
        title: "인스타그램 연동 필요",
        description: "인스타그램 계정을 연결하면 이 시리즈의 독자 반응 데이터를 분석해 최적의 다음 화 소재를 추천해 드려요.",
        badge: "연동 대기",
      },
    };
  }

  // Filter metrics belonging to this series
  const matched = (snsData.topEpisodes || []).filter(
    (item) => item.seriesId === series.id || item.seriesTitle === series.title
  );

  const episodeMetrics: Record<string, SnsEpisodeMetric> = {};
  for (const m of matched) {
    episodeMetrics[m.episodeId] = m;
  }

  // Also match by episode number if id was generated differently
  for (const ep of episodes) {
    if (!episodeMetrics[ep.id]) {
      const matchByNumber = matched.find((m) => m.episodeNumber === ep.number);
      if (matchByNumber) {
        episodeMetrics[ep.id] = matchByNumber;
      }
    }
  }

  const validMetrics = Object.values(episodeMetrics);
  const totalReach = validMetrics.reduce((sum, m) => sum + (m.reach || 0), 0);
  const totalSaves = validMetrics.reduce((sum, m) => sum + (m.saves || 0), 0);
  const totalShares = validMetrics.reduce((sum, m) => sum + (m.shares || 0), 0);
  const totalLikes = validMetrics.reduce((sum, m) => sum + (m.likes || 0), 0);

  const totalInteractions = totalLikes + totalSaves + totalShares;
  const avgEngagementRate =
    totalReach > 0 ? Number(((totalInteractions / totalReach) * 100).toFixed(1)) : 0;

  // Find top episode by save rate or reach
  let topEpisode: SnsEpisodeMetric | null = null;
  if (validMetrics.length > 0) {
    topEpisode = [...validMetrics].sort((a, b) => (b.saves || 0) - (a.saves || 0))[0] || null;
  }

  // Generate dynamic AI recommendation tailored to this specific series
  let aiRecommendation = {
    title: "독자 반응 분석 소재 추천",
    description: "지난 회차들의 공감 포인트를 살려 질문형 후킹으로 다음 화를 기획해보세요.",
    badge: "+25% 도달 상승 예측",
  };

  if (series.id === "sr_villain" || series.title.includes("직장")) {
    aiRecommendation = {
      title: "직장인 짠내 공감 소재 추천",
      description:
        "저장율이 2.92%로 가장 높았던 '내 아이디어' 회차처럼, '퇴근 10분 전 슬랙 메신저'나 '점심 메뉴 결정 난제'를 다루면 저장 수가 폭발할 것으로 예상돼요.",
      badge: "+28% 도달 상승 예측",
    };
  } else if (series.id === "sr_cat" || series.title.includes("고양이")) {
    aiRecommendation = {
      title: "반려묘 심쿵 행동 후킹 추천",
      description:
        "1화의 '현관 앞 수문장' 컷이 냥스타그램 태그 유입의 70%를 차지했어요. '집사 양말 물고 도망치기' 등 고양이의 돌발 행동을 1번 컷에 배치하면 탐색 탭 노출 확률이 급증합니다.",
      badge: "+35% 탐색 탭 노출",
    };
  } else if (series.id === "sr_dev" || series.title.includes("개발자")) {
    aiRecommendation = {
      title: "개발자 극공감 멘붕 컷 추천",
      description:
        "3화 '핫픽스 롤백'의 멘붕 컷이 인스타 스토리·DM에서 420회 공유되었어요. '주말 온콜 당번 실화'를 주제로 다음 화를 이어가면 바이럴 확산률이 높습니다.",
      badge: "+40% 공유 확산 예측",
    };
  } else if (validMetrics.length > 0 && topEpisode) {
    aiRecommendation = {
      title: `'${topEpisode.title || `${topEpisode.episodeNumber}화`}' 성과 연계 추천`,
      description: `저장 ${topEpisode.saves}회를 기록한 직전 최고 성과 회차의 결말과 이어지는 사연을 다루면 시리즈 재방문율을 극대화할 수 있어요.`,
      badge: "+30% 재방문 상승",
    };
  }

  return {
    connected,
    username,
    totalReach,
    totalSaves,
    totalShares,
    totalLikes,
    avgEngagementRate,
    publishedCount: validMetrics.length,
    topEpisode,
    episodeMetrics,
    aiRecommendation,
  };
}
