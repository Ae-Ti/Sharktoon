/**
 * 구조화 출력 LLM 호출 — 콘티(2.2)와 게시물 패키지(4.1)가 같이 쓴다.
 *
 * 스키마 하나를 Zod 로 정의해 모델에 넘기고 `parse()` 로 받는다. 모델이 필드를 빠뜨리거나
 * 종류를 지어내면 파싱에서 걸린다. 서버에서만 돈다.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/**
 * Claude Opus 5.5. 짧은 한국어 카피라 깊게 생각할 일은 아니어서 effort 는 medium 이다.
 * 이 모델은 생각을 끌 수 없고 effort 기본값도 medium 이지만, 바꿀 때 보이도록 적어 둔다.
 */
export const LLM_MODEL = "claude-opus-5-5";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type StructuredResult<T> =
  | { ok: true; data: T }
  /** 모델의 안전 판정으로 거절됐다. 사용자가 입력을 고쳐야 한다. */
  | { ok: false; reason: "refusal" }
  | { ok: false; reason: "error"; message: string };

export async function parseStructured<S extends z.ZodType>(input: {
  schema: S;
  /** 요청마다 같은 부분. 캐시가 걸리므로 사용자 입력·시각을 넣지 않는다. */
  system: string;
  /** 요청마다 바뀌는 부분. */
  user: string;
}): Promise<StructuredResult<z.infer<S>>> {
  const client = new Anthropic();

  try {
    const response = await client.beta.messages.parse({
      model: LLM_MODEL,
      max_tokens: 16000,
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(input.schema),
      },
      // 안전 분류기가 오탐으로 거절하면 같은 요청을 다른 모델로 다시 돌린다.
      // 거절 분류에 맞춰 서버가 고르므로 모델 목록을 우리가 관리하지 않는다.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: input.system, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: input.user }],
    });

    if (response.stop_reason === "refusal") return { ok: false, reason: "refusal" };
    if (!response.parsed_output) {
      return { ok: false, reason: "error", message: "응답 형식이 어긋났어요." };
    }
    return { ok: true, data: response.parsed_output as z.infer<S> };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, reason: "error", message: "지금 요청이 많아요. 잠시 뒤에 다시 시도해 주세요." };
    }
    if (e instanceof Anthropic.APIError) {
      return { ok: false, reason: "error", message: "만들지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
    }
    throw e;
  }
}
