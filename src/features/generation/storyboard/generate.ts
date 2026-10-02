/**
 * 콘티 생성 — 오너: 웅싯(A). PRD 2.2.
 *
 * 서버에서만 돈다. ANTHROPIC_API_KEY 가 없으면 목 콘티를 돌려주므로
 * 키 없이도 화면·플로우 전체를 만들 수 있다(태일의 `getRepository` 와 같은 방식).
 */

import "server-only";

import { StoryboardResponseSchema, type StoryboardResponse } from "./schema";
import {
  STORYBOARD_SYSTEM,
  buildStoryboardUserMessage,
  type StoryboardPromptInput,
} from "./prompt";
import { screenText } from "../safety/rules";
import { ALLOWED, blocked, type SafetyVerdict } from "../safety/types";
import type { Storyboard, StoryboardCut } from "../types/storyboard";
import { mockStoryboard } from "./mock";
import { isAnthropicConfigured, parseStructured } from "../llm";


/** 콘티 생성은 크레딧을 쓰지 않는다(PRD 3.1 비즈니스 규칙). 실패해도 환불 처리가 없다. */
export interface GenerateStoryboardInput extends StoryboardPromptInput {
  episodeId: string;
  seriesId: string;
}

export type GenerateStoryboardResult =
  | { ok: true; storyboard: Storyboard; usedMock: boolean }
  | { ok: false; safety: SafetyVerdict }
  | { ok: false; error: string };

export { isAnthropicConfigured };

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
      storyboard: mockStoryboard(input),
    };
  }

  const result = await parseStructured({
    schema: StoryboardResponseSchema,
    system: STORYBOARD_SYSTEM,
    user: buildStoryboardUserMessage(input),
  });
  if (!result.ok) {
    return result.reason === "refusal"
      ? { ok: false, safety: blocked("explicit", "model") }
      : { ok: false, error: result.message };
  }
  const parsed: StoryboardResponse = result.data;

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
    characters: res.characters.map((c) => ({ key: c.key, name: c.name })),
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

/** 한 콘티 안에서 유일하면 된다. 컷 id 가 그대로 저장 키(cuts.cut_id)가 되므로 난수를 섞는다. */
function idSequence() {
  const salt = crypto.randomUUID().slice(0, 6);
  let n = 0;
  return (prefix: string) => `${prefix}_${salt}${(++n).toString(36)}`;
}

export { ALLOWED };
