/**
 * 콘티 LLM 응답의 스키마 — 오너: 웅싯(A). PRD 2.2 "LLM 프롬프트·스키마 검증".
 *
 * 이 스키마가 곧 구조화 출력의 계약이다. Zod 로 한 번만 정의하고
 * `zodOutputFormat` 으로 모델에 넘기므로, 모델이 필드를 빠뜨리거나
 * 종류를 지어내는 경우가 파싱 단계에서 걸린다.
 *
 * `types/storyboard.ts` 의 도메인 타입과 모양이 같지만 id·시각처럼
 * 서버가 매기는 값은 여기 없다. 모델이 id 를 짓게 두면 충돌한다.
 */

import { z } from "zod";

const CAMERA = z.enum([
  "extreme_wide",
  "wide",
  "medium",
  "close_up",
  "extreme_close_up",
  "over_shoulder",
  "pov",
  "top_down",
]);

const EMOTION = z.enum([
  "joy",
  "sad",
  "angry",
  "anxious",
  "surprised",
  "embarrassed",
  "calm",
  "determined",
]);

const BALLOON = z.enum([
  "normal",
  "thought",
  "shout",
  "whisper",
  "narration_box",
  "telepathy",
  "broadcast",
  "wobble",
  "spike",
  "cloud",
  "chain",
  "none",
]);

const LineSchema = z.object({
  /** 등장인물 키. 화자가 없으면 빈 문자열(효과음·나레이션). */
  speaker: z.string(),
  text: z.string(),
  balloon: BALLOON,
});

const CutSchema = z.object({
  /** 무엇이 보이는지. 이미지 프롬프트의 본문이 된다. */
  scene: z.string(),
  /** 이 컷에 나오는 등장인물 키. characters 에 있는 것만 쓴다. */
  characters: z.array(z.string()),
  emotion: EMOTION,
  camera: CAMERA,
  dialogue: z.array(LineSchema),
  /** 말풍선 밖 나레이션. 없으면 빈 문자열. */
  narration: z.string(),
});

const CopySchema = z.object({
  text: z.string(),
  /** 왜 이 안인지. 사용자가 고를 근거가 된다. */
  rationale: z.string(),
});

const CtaSchema = CopySchema.extend({
  kind: z.enum(["like", "next_episode", "question"]),
});

/**
 * 모델이 돌려주는 전부. `safety` 가 2차 필터다 — 규칙 필터를 통과한
 * 요청을 모델이 다시 판정하고, 막을 때는 컷을 만들지 않는다.
 */
export const StoryboardResponseSchema = z.object({
  safety: z.object({
    allowed: z.boolean(),
    category: z.enum(["real_person", "minor", "third_party_ip", "explicit", "none"]),
    reason: z.string(),
  }),
  /** 등장인물 키 → 표시 이름. 사연에서 뽑는다. */
  characters: z.array(z.object({ key: z.string(), name: z.string() })),
  cuts: z.array(CutSchema),
  /** 1컷 후킹 3안. */
  hooks: z.array(CopySchema),
  /** 마지막 컷 CTA 3안. 종류가 서로 달라야 한다. */
  ctas: z.array(CtaSchema),
});

export type StoryboardResponse = z.infer<typeof StoryboardResponseSchema>;
