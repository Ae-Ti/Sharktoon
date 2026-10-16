/**
 * Instagram 게시 규격 — Instagram API with Instagram Login (graph.instagram.com).
 *
 * 2026-10-16 Meta 공식 문서(v25.0) 기준. 화면 검증과 서버 게시가 같은 값을 쓴다.
 * 숫자를 고칠 때는 문서를 다시 확인한다:
 * - https://developers.facebook.com/docs/instagram-platform/content-publishing
 * - https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
 */

/** 캐러셀 장수. 1장이면 캐러셀이 아니라 단일 이미지 게시다. */
export const IG_CAROUSEL_MIN = 2;
export const IG_CAROUSEL_MAX = 10;

/** 캡션. 해시태그와 @멘션은 캡션 안에서 센다. */
export const IG_CAPTION_MAX_CHARS = 2200;
export const IG_CAPTION_MAX_HASHTAGS = 30;
export const IG_CAPTION_MAX_MENTIONS = 20;

/** 피드 이미지. JPEG 만 받고, Meta 가 공개 URL 에서 직접 가져간다(바이너리 업로드 없음). */
export const IG_IMAGE = {
  contentType: "image/jpeg",
  maxBytes: 8 * 1024 * 1024,
  minWidth: 320,
  maxWidth: 1440,
  /** 세로 4:5 ~ 가로 1.91:1. 캐러셀은 첫 장 비율로 나머지를 자른다. */
  minAspect: 4 / 5,
  maxAspect: 1.91,
} as const;

/** 릴스(PRD 5.1 애니메이션). 아직 만들지 않았다 — 출력 규격을 정할 때 이 값에 맞춘다. */
export const IG_REELS = {
  containers: ["video/mp4", "video/quicktime"],
  videoCodec: "H.264 또는 HEVC, progressive, closed GOP, 4:2:0",
  audioCodec: "AAC, 48kHz 이하, 128kbps, 모노/스테레오",
  recommendedAspect: 9 / 16,
  maxWidth: 1920,
  minFps: 23,
  maxFps: 60,
  maxBitrateMbps: 25,
  minSeconds: 3,
  maxSeconds: 15 * 60,
  maxBytes: 300 * 1024 * 1024,
} as const;

/** 게시 준비(컨테이너)는 만든 지 24시간이 지나면 만료된다. 발행 직전에 만든다. */
export const IG_CONTAINER_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 계정당 24시간 게시 한도. 문서가 50 과 100 을 섞어 쓴다 — 실제 값은
 * `GET /{ig-user-id}/content_publishing_limit` 로 그때그때 읽고, 이 값은 읽지 못했을 때만 쓴다.
 */
export const IG_PUBLISH_LIMIT_FALLBACK = 50;

/**
 * 한 화의 컷 수. 인스타툰은 캐러셀 한 장에 한 컷이다(PRD 용어집: 4~10컷).
 * DB 제약(episodes.cut_count, series_rules.default_cut_count)과 같은 범위다.
 * 표지 컷도 한 장으로 센다.
 */
export const EPISODE_CUTS_MIN = 4;
export const EPISODE_CUTS_MAX = IG_CAROUSEL_MAX;

export interface CaptionCheck {
  /** 인스타에 실제로 올라가는 글. 본문 + 빈 줄 + 해시태그. */
  text: string;
  chars: number;
  hashtags: number;
  mentions: number;
  /** 한도를 넘은 항목. 비어 있으면 게시할 수 있다. */
  problems: string[];
}

/** 본문과 해시태그를 합쳐 인스타 캡션 한도를 검사한다. 글자 수는 코드 포인트로 센다. */
export function composeInstagramCaption(caption: string, tags: string[]): CaptionCheck {
  const body = caption.trim();
  const tagLine = tags
    .map((t) => t.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(" ");
  const text = [body, tagLine].filter(Boolean).join("\n\n");
  const chars = [...text].length;
  const hashtags = (text.match(/#[^\s#]+/g) ?? []).length;
  const mentions = (text.match(/@[\w.]+/g) ?? []).length;

  const problems: string[] = [];
  if (chars > IG_CAPTION_MAX_CHARS) {
    problems.push(`본문과 해시태그를 합쳐 ${IG_CAPTION_MAX_CHARS.toLocaleString()}자까지예요 (지금 ${chars.toLocaleString()}자).`);
  }
  if (hashtags > IG_CAPTION_MAX_HASHTAGS) {
    problems.push(`해시태그는 ${IG_CAPTION_MAX_HASHTAGS}개까지예요 (지금 ${hashtags}개).`);
  }
  if (mentions > IG_CAPTION_MAX_MENTIONS) {
    problems.push(`@멘션은 ${IG_CAPTION_MAX_MENTIONS}개까지예요 (지금 ${mentions}개).`);
  }
  return { text, chars, hashtags, mentions, problems };
}
