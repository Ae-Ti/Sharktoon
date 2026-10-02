/**
 * 콘티 생성 — 오너: 웅싯(A). PRD 2.2.
 *
 * 서버에서만 돈다. ANTHROPIC_API_KEY 가 없으면 목 콘티를 돌려주므로
 * 키 없이도 화면·플로우 전체를 만들 수 있다(태일의 `getRepository` 와 같은 방식).
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { StoryboardResponseSchema, type StoryboardResponse } from "./schema";
import {
  STORYBOARD_SYSTEM,
  buildStoryboardUserMessage,
  type StoryboardPromptInput,
} from "./prompt";
import { screenText } from "../safety/rules";
import { ALLOWED, blocked, type SafetyVerdict } from "../safety/types";
import type { Storyboard, StoryboardCut } from "../types/storyboard";
import { MOCK_STORYBOARD } from "../mocks/storyboard";

const MODEL = "claude-opus-5";

/** 콘티 생성은 크레딧을 쓰지 않는다(PRD 3.1 비즈니스 규칙). 실패해도 환불 처리가 없다. */
export interface GenerateStoryboardInput extends StoryboardPromptInput {
  episodeId: string;
  seriesId: string;
}

export type GenerateStoryboardResult =
  | { ok: true; storyboard: Storyboard; usedMock: boolean }
  | { ok: false; safety: SafetyVerdict }
  | { ok: false; error: string };

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function generateStoryboard(
  input: GenerateStoryboardInput,
): Promise<GenerateStoryboardResult> {
  // 1차 필터. 모델을 부르기 전에 막아야 왕복이 없다.
  const pre = screenText(input.story);
  if (!pre.allowed) return { ok: false, safety: pre };

  if (!isAnthropicConfigured()) {
    return {
      ok: true,
      usedMock: true,
      storyboard: {
        ...MOCK_STORYBOARD,
        episodeId: input.episodeId,
        seriesId: input.seriesId,
        story: input.story,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  const client = new Anthropic();

  let parsed: StoryboardResponse | null;
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // 콘티는 30초 안에 나와야 한다(PRD 비기능 요구사항). 깊게 생각할 일이 아니다.
      output_config: {
        effort: "medium",
        format: zodOutputFormat(StoryboardResponseSchema),
      },
      system: [
        {
          type: "text",
          text: STORYBOARD_SYSTEM,
          // 시스템 프롬프트는 요청마다 같다. 사연만 뒤에서 바뀐다.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildStoryboardUserMessage(input) }],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, safety: blocked("explicit", "model") };
    }
    parsed = response.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "지금 요청이 많아요. 잠시 뒤에 다시 시도해 주세요." };
    }
    if (e instanceof Anthropic.APIError) {
      return { ok: false, error: "콘티를 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
    }
    throw e;
  }

  if (!parsed) {
    // 스키마 검증 실패. 모델이 모양을 어겼다는 뜻이라 재시도해도 같을 수 있다.
    return { ok: false, error: "콘티 형식이 어긋났어요. 사연을 조금 더 자세히 적어주세요." };
  }

  // 2차 필터. 규칙을 통과했지만 모델이 막은 경우다.
  if (!parsed.safety.allowed) {
    const category = parsed.safety.category;
    return {
      ok: false,
      safety:
        category === "none"
          ? blocked("explicit", "model", parsed.safety.reason)
          : blocked(category, "model", parsed.safety.reason),
    };
  }

  return { ok: true, usedMock: false, storyboard: toStoryboard(parsed, input) };
}

/**
 * 모델 응답을 도메인 타입으로 옮긴다. id 와 시각은 여기서 매긴다 —
 * 모델이 짓게 두면 회차끼리 충돌한다.
 */
function toStoryboard(
  res: StoryboardResponse,
  input: GenerateStoryboardInput,
): Storyboard {
  const now = new Date().toISOString();
  const seq = idSequence();

  const cuts: StoryboardCut[] = res.cuts.map((cut, i) => ({
    id: seq("cut"),
    index: i + 1,
    scene: cut.scene,
    characterIds: cut.characters,
    emotion: cut.emotion,
    camera: cut.camera,
    dialogue: cut.dialogue.map((line) => ({
      id: seq("ln"),
      speakerId: line.speaker === "" ? null : line.speaker,
      text: line.text,
      balloon: line.balloon,
    })),
    narration: cut.narration === "" ? undefined : cut.narration,
  }));

  return {
    id: seq("sb"),
    episodeId: input.episodeId,
    seriesId: input.seriesId,
    status: "draft",
    story: input.story,
    cuts,
    hookOptions: res.hooks.map((h) => ({ id: seq("hook"), text: h.text, rationale: h.rationale })),
    // 사용자가 직접 고르게 둔다. 기본 선택을 넣으면 그대로 넘어가 버린다.
    selectedHookId: null,
    ctaOptions: res.ctas.map((c) => ({
      id: seq("cta"),
      kind: c.kind,
      text: c.text,
      rationale: c.rationale,
    })),
    selectedCtaId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** 한 응답 안에서만 유일하면 된다. DB 에 넣을 때 진짜 id 로 바뀐다. */
function idSequence() {
  let n = 0;
  return (prefix: string) => `${prefix}_${(++n).toString(36)}${Date.now().toString(36)}`;
}

export { ALLOWED };
