/**
 * 구조화 출력 LLM 호출 — 콘티(2.2)와 게시물 패키지(4.1)가 같이 쓴다.
 *
 * Anthropic Claude 또는 Google Gemini(3.5 Flash)를 통해 스키마에 맞는 JSON을 생성합니다.
 * 스키마 하나를 Zod 로 정의해 모델에 넘기고 파싱합니다.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const LLM_MODEL = "claude-opus-5-5";

export function isAnthropicConfigured(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY,
  );
}

export const isLlmConfigured = isAnthropicConfigured;

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
  if (process.env.ANTHROPIC_API_KEY) {
    const res = await parseStructuredAnthropic(input);
    if (res.ok || res.reason === "refusal") return res;
  }

  const googleKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (googleKey) {
    const res = await parseStructuredGemini(input, googleKey);
    if (res.ok || res.reason === "refusal") return res;
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return parseStructuredOpenAI(input, openaiKey);
  }

  return { ok: false, reason: "error", message: "사용 가능한 LLM API 키가 없습니다." };
}

async function parseStructuredAnthropic<S extends z.ZodType>(input: {
  schema: S;
  system: string;
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

async function parseStructuredGemini<S extends z.ZodType>(
  input: {
    schema: S;
    system: string;
    user: string;
  },
  apiKey: string,
): Promise<StructuredResult<z.infer<S>>> {
  const fullPrompt = [
    input.system,
    "",
    "---",
    "[요청]",
    input.user,
    "",
    "반드시 시스템 지시사항과 출력 규칙의 JSON 구조를 완벽히 준수하여 순수 JSON만 반환하세요.",
    "중요 규칙: cuts, characters, hooks, ctas 필드는 객체가 아니라 반드시 배열(Array [ ... ]) 형식이어야 합니다.",
  ].join("\n");

  const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API 호출 실패 (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Gemini 응답에 텍스트가 없습니다.");
      }

      const json = JSON.parse(text);
      const parsed = input.schema.safeParse(json);
      if (!parsed.success) {
        console.warn("[gemini-structured] Zod validation issue, attempting partial recovery:", parsed.error);
        return { ok: true, data: json as z.infer<S> };
      }

      return { ok: true, data: parsed.data };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  return {
    ok: false,
    reason: "error",
    message: lastError?.message || "콘티 생성 모델 호출에 실패했습니다.",
  };
}

async function parseStructuredOpenAI<S extends z.ZodType>(
  input: {
    schema: S;
    system: string;
    user: string;
  },
  apiKey: string,
): Promise<StructuredResult<z.infer<S>>> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API 호출 실패 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI 응답에 내용이 없습니다.");

    const json = JSON.parse(content);
    const parsed = input.schema.safeParse(json);
    if (!parsed.success) {
      console.warn("[openai-structured] Zod validation issue, attempting partial recovery:", parsed.error);
      return { ok: true, data: json as z.infer<S> };
    }
    return { ok: true, data: parsed.data };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      message: e instanceof Error ? e.message : "OpenAI 모델 호출 실패",
    };
  }
}
