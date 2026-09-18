"use server";

import { InsufficientCreditError } from "@/contracts/credit";
import type { CutEditIntent, GenerationJob } from "@/contracts/generation";
import {
  generateStoryboard,
  isAnthropicConfigured,
} from "./storyboard/generate";
import {
  regenerateCut,
  retryFailedCuts,
  startGeneration,
} from "./pipeline";
import type { Storyboard } from "./types/storyboard";

/** 화면이 받는 결과. 실패 사유를 문구 하나로 뭉개지 않는다 — 처리가 다르다. */
export type ActionResult<T> =
  | { ok: true; data: T }
  /** 콘텐츠 필터. 사용자가 입력을 고쳐야 한다. */
  | { ok: false; kind: "safety"; message: string }
  /** 크레딧 부족. 충전 시트를 연다. */
  | { ok: false; kind: "credit"; message: string; required: number; available: number }
  | { ok: false; kind: "error"; message: string };

/** PRD 2.2 — 사연에서 콘티를 만든다. 크레딧을 쓰지 않는다. */
export async function generateStoryboardAction(input: {
  story: string;
  episodeId: string;
  seriesId: string;
  cutCount: number;
  seriesRule?: string;
  fixedCharacters?: string[];
}): Promise<ActionResult<{ storyboard: Storyboard; usedMock: boolean }>> {
  if (input.story.trim().length < 10) {
    return { ok: false, kind: "error", message: "사연을 조금 더 적어주세요. 한 문장이면 충분해요." };
  }

  const result = await generateStoryboard(input);

  if (!result.ok) {
    if ("safety" in result) {
      return { ok: false, kind: "safety", message: result.safety.message! };
    }
    return { ok: false, kind: "error", message: result.error };
  }

  return { ok: true, data: { storyboard: result.storyboard, usedMock: result.usedMock } };
}

/** PRD 3.1.1 — 에이전트 모드 전체 생성. */
export async function startGenerationAction(
  storyboard: Storyboard,
): Promise<ActionResult<GenerationJob>> {
  try {
    const result = await startGeneration({
      // 인증이 붙기 전까지의 대역. 태일의 세션에서 받아오도록 바꾼다.
      userId: "u_local",
      storyboard,
      mode: "agent",
    });

    if (!result.ok) {
      return result.reason === "safety"
        ? { ok: false, kind: "safety", message: result.message }
        : { ok: false, kind: "error", message: result.message };
    }
    return { ok: true, data: result.job };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** PRD 3.1.2 — 한 컷만 다시. */
export async function regenerateCutAction(input: {
  jobId: string;
  cutId: string;
  intent: CutEditIntent;
  prompt?: string;
}): Promise<ActionResult<null>> {
  try {
    const result = await regenerateCut(input);
    if (!result.ok) {
      return { ok: false, kind: "safety", message: result.message ?? "다시 만들 수 없어요" };
    }
    return { ok: true, data: null };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** 실패한 컷만 재시도. 성공한 컷은 건드리지 않는다. */
export async function retryFailedCutsAction(jobId: string): Promise<ActionResult<null>> {
  try {
    await retryFailedCuts(jobId);
    return { ok: true, data: null };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** 목 데이터로 돌고 있는지. 화면이 배지로 알린다. */
export async function generationEnvAction(): Promise<{ anthropic: boolean }> {
  return { anthropic: isAnthropicConfigured() };
}

function toCreditOrError(e: unknown): ActionResult<never> {
  if (e instanceof InsufficientCreditError) {
    return {
      ok: false,
      kind: "credit",
      message: e.message,
      required: e.required,
      available: e.available,
    };
  }
  return {
    ok: false,
    kind: "error",
    message: e instanceof Error ? e.message : "처리하지 못했어요",
  };
}
