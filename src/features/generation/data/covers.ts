import "server-only";

import type { EpisodeSummary } from "@/features/platform/data/types";
import { getGenerationStore } from "./index";

/**
 * 회차·작품 대표 이미지. 저장해 둔 값에 기대지 않고 읽을 때 컷에서 고른다 —
 * 실 저장소는 회차 썸네일 열이 없고, 목 저장소도 예전 작품에는 화풍 이미지가 박혀 있다.
 * 맨 앞(표지가 있으면 표지) 컷 이미지가 회차 대표, 가장 최근 회차의 대표가 작품 대표다.
 */

export async function episodeCoverUrl(episodeId: string): Promise<string | null> {
  const store = await getGenerationStore();
  const cuts = await store.listCuts(episodeId);
  return cuts.find((c) => c.imageUrl)?.imageUrl ?? null;
}

/** 회차마다 대표 이미지. 컷이 없으면 원래 값(시드 데이터의 썸네일 등)을 둔다. */
export async function withEpisodeCovers<T extends EpisodeSummary>(episodes: T[]): Promise<T[]> {
  return Promise.all(
    episodes.map(async (e) => ({ ...e, thumbUrl: (await episodeCoverUrl(e.id)) ?? e.thumbUrl ?? null })),
  );
}

/** 작품 대표: 최근 회차부터 컷이 있는 첫 회차의 대표 컷. 없으면 null(화면이 화풍 이미지 등으로 대신한다). */
export async function seriesCoverUrl(episodes: EpisodeSummary[]): Promise<string | null> {
  const latestFirst = [...episodes].sort((a, b) => b.number - a.number);
  for (const e of latestFirst) {
    const url = await episodeCoverUrl(e.id);
    if (url) return url;
  }
  return null;
}
