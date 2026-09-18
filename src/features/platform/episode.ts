import { getRepository } from "./data";
import type { EpisodeContext } from "./data/types";

export type { EpisodeContext };

/**
 * 회차 하나를 생성하는 데 필요한 고정 컨텍스트를 읽는다 — 오너: 태일(B).
 *
 * 콘티·생성·편집 화면(웅싯)이 목 데이터 대신 이걸 쓴다.
 * 서버 컴포넌트에서 부르고, 없는 회차면 null 이다.
 */
export async function loadEpisodeContext(
  episodeId: string,
): Promise<EpisodeContext | null> {
  const repo = await getRepository();
  return repo.getEpisodeContext(episodeId);
}
