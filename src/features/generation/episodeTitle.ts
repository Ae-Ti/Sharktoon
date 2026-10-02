import type { EpisodeContext } from "@/features/platform/episode";

/** 회차 컨텍스트가 없을 때(주소로 바로 들어온 경우) 화면이 보여줄 값. */
export const FALLBACK_TITLES = {
  seriesTitle: "샘플 시리즈",
  episodeTitle: "예시 회차",
};

export function titlesOf(context: EpisodeContext | null) {
  if (!context) return FALLBACK_TITLES;
  return {
    seriesTitle: context.seriesTitle,
    episodeTitle: `${context.number}화`,
  };
}
