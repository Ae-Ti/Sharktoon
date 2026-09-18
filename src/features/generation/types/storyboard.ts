/**
 * 콘티(스토리보드) 타입 — 오너: 웅싯(A). PRD 2.2.
 *
 * 태일 화면은 이 타입을 읽지 않으므로 접점(`src/contracts/`)이 아니라 여기 둔다.
 * LLM 응답을 이 모양으로 스키마 검증한 뒤에야 컷 편집과 생성으로 넘긴다.
 */

import type { BalloonKind } from "./layer";

/** 카메라 지시. 프롬프트에 그대로 실린다. */
export type CameraShot =
  | "extreme_wide"
  | "wide"
  | "medium"
  | "close_up"
  | "extreme_close_up"
  | "over_shoulder"
  | "pov"
  | "top_down";

export const CAMERA_LABEL: Record<CameraShot, string> = {
  extreme_wide: "익스트림 롱",
  wide: "롱",
  medium: "미디엄",
  close_up: "클로즈업",
  extreme_close_up: "익스트림 클로즈업",
  over_shoulder: "오버 숄더",
  pov: "시점",
  top_down: "부감",
};

/** 컷의 지배 감정. 표정·색 온도 프롬프트로 내려간다. */
export type CutEmotion =
  | "joy"
  | "sad"
  | "angry"
  | "anxious"
  | "surprised"
  | "embarrassed"
  | "calm"
  | "determined";

export const EMOTION_LABEL: Record<CutEmotion, string> = {
  joy: "기쁨",
  sad: "슬픔",
  angry: "분노",
  anxious: "불안",
  surprised: "놀람",
  embarrassed: "당황",
  calm: "평온",
  determined: "결심",
};

/** 컷 안의 대사 한 줄. 말풍선 종류는 편집기가 레이어를 만들 때 쓰는 힌트다. */
export interface StoryboardLine {
  id: string;
  /** 등장인물 id. 나레이션은 화자가 없다. */
  speakerId: string | null;
  text: string;
  balloon: BalloonKind;
}

export interface StoryboardCut {
  id: string;
  /** 1부터. 순서를 바꾸면 다시 매긴다. */
  index: number;
  /** 무엇이 보이는지. 이미지 프롬프트의 본문이 된다. */
  scene: string;
  /** 이 컷에 나오는 등장인물 id. 캐릭터 시트 레퍼런스를 고르는 키다. */
  characterIds: string[];
  emotion: CutEmotion;
  camera: CameraShot;
  dialogue: StoryboardLine[];
  /** 말풍선 밖 나레이션. 없으면 비운다. */
  narration?: string;
}

/** 첫 컷 후킹 / 마지막 컷 CTA 후보. 각각 3안을 준다(PRD 2.2). */
export interface CopyOption {
  id: string;
  text: string;
  /** 왜 이 안인지. 고르는 근거가 없으면 첫 사용자는 1번만 고른다. */
  rationale: string;
}

/** 마지막 컷 CTA 의 종류. 3안은 서로 다른 종류로 낸다. */
export type CtaKind = "like" | "next_episode" | "question";

export const CTA_KIND_LABEL: Record<CtaKind, string> = {
  like: "좋아요 유도",
  next_episode: "다음 화 예고",
  question: "질문형",
};

export interface CtaOption extends CopyOption {
  kind: CtaKind;
}

export type StoryboardStatus = "draft" | "confirmed" | "generating" | "generated";

export interface Storyboard {
  id: string;
  episodeId: string;
  seriesId: string;
  status: StoryboardStatus;
  /** 사용자가 넣은 사연 원문. 한 줄부터 한 문단까지. */
  story: string;
  cuts: StoryboardCut[];
  /** 첫 컷 후킹 3안과 선택값. 고르기 전에는 selected 가 null 이다. */
  hookOptions: CopyOption[];
  selectedHookId: string | null;
  ctaOptions: CtaOption[];
  selectedCtaId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 컷을 옮긴 뒤 index 를 1부터 다시 매긴다. 원본은 건드리지 않는다. */
export function reindexCuts(cuts: StoryboardCut[]): StoryboardCut[] {
  return cuts.map((cut, i) => (cut.index === i + 1 ? cut : { ...cut, index: i + 1 }));
}

/** 이미지 생성으로 넘어갈 수 있는지. 후킹·CTA 를 안 고르면 막는다. */
export function canGenerate(storyboard: Storyboard): boolean {
  return (
    storyboard.cuts.length > 0 &&
    storyboard.selectedHookId !== null &&
    storyboard.selectedCtaId !== null
  );
}
