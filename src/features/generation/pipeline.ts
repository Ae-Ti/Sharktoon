/**
 * 생성 파이프라인 — 오너: 웅싯(A). PRD 3.1.
 *
 * 콘티 → 큐 등록 → 컷별 생성 → 성공하면 commit, 실패하면 refund 까지를 묶는다.
 * 큐와 생성기는 인터페이스 뒤에 있으므로 여기 코드는 둘이 바뀌어도 그대로 간다.
 *
 * hold 는 **컷마다** 건다. 잡 단위로 한 번에 잡으면 "6컷 중 4컷 성공"에서
 * 얼마를 돌려줘야 하는지가 원장에 남지 않는다.
 */

import "server-only";

import { CREDIT_COST } from "@/contracts/credit";
import {
  CREDIT_REASON_BY_INTENT,
  type CutEditIntent,
  type GenerationJob,
  type GenerationMode,
} from "@/contracts/generation";
import { getRepository } from "@/features/platform/data";
import { getImageGenerator } from "./image";
import { createMemoryQueue } from "./queue/memory";
import type { JobQueue } from "./queue/types";
import { screenText } from "./safety/rules";
import type { Storyboard } from "./types/storyboard";

/** 컷 하나를 만드는 일. 크레딧 hold/commit/refund 가 여기서 닫힌다. */
async function generateOneCut({
  job,
  cut,
}: {
  job: GenerationJob;
  cut: GenerationJob["cuts"][number];
}) {
  const repo = await getRepository();
  const generator = getImageGenerator();

  const context = jobContext.get(job.id);
  const cutContext = context?.cuts.get(cut.cutId);
  const intent: CutEditIntent = cutContext?.intent ?? "regenerate";
  const reason = CREDIT_REASON_BY_INTENT[intent];
  const amount =
    reason === "cut_image" ? CREDIT_COST.cutImage : CREDIT_COST.partialRegenerate;

  // 생성 요청 직전에 잡는다. 모자라면 여기서 InsufficientCreditError 가 나고
  // 화면은 그걸 받아 충전 시트를 연다(버튼을 disabled 로 막지 않는다).
  const holdId = await repo.holdCredit({ amount, reason, jobId: job.id });

  try {
    const result = await generator.generateCut({
      cutId: cut.cutId,
      episodeId: job.episodeId,
      seriesId: job.seriesId ?? "",
      intent,
      prompt: cutContext?.prompt ?? "",
      characterSheetRefs: context?.characterSheetRefs ?? [],
      assetRefs: context?.assetRefs ?? [],
      seriesRule: context?.seriesRule ?? {},
    });
    await repo.commitCredit(holdId);
    return { imageUrl: result.imageUrl };
  } catch (e) {
    // 실패한 요청의 크레딧은 자동 환불한다(PRD 3.1.1 예외).
    await repo.refundCredit(holdId, e instanceof Error ? e.message : "생성 실패");
    throw e;
  }
}

/**
 * 컷별 프롬프트와 시리즈 컨텍스트. 큐에는 id 만 흐르고 무거운 값은 여기 둔다.
 * 실제 큐(pgmq/Workflows)로 바뀌면 이 자리는 DB 조회가 된다.
 */
interface JobContext {
  cuts: Map<string, { prompt: string; intent: CutEditIntent }>;
  characterSheetRefs: string[];
  assetRefs: string[];
  seriesRule: Record<string, unknown>;
}

const jobContext = new Map<string, JobContext>();

let queue: JobQueue | null = null;

function getQueue(): JobQueue {
  queue ??= createMemoryQueue(generateOneCut);
  return queue;
}

export interface StartGenerationInput {
  userId: string;
  storyboard: Storyboard;
  mode: GenerationMode;
  characterSheetRefs?: string[];
  assetRefs?: string[];
  seriesRule?: Record<string, unknown>;
}

export type StartGenerationResult =
  | { ok: true; job: GenerationJob }
  | { ok: false; reason: "safety"; message: string }
  | { ok: false; reason: "error"; message: string };

/** 에이전트 모드 전체 생성. 콘티의 모든 컷을 큐에 등록한다(PRD 3.1.1). */
export async function startGeneration(
  input: StartGenerationInput,
): Promise<StartGenerationResult> {
  const { storyboard } = input;

  // 컷 장면은 그대로 프롬프트가 되므로 여기서도 필터를 건다.
  // 콘티 단계를 통과했어도 사용자가 장면을 직접 고쳤을 수 있다.
  for (const cut of storyboard.cuts) {
    const verdict = screenText(`${cut.scene} ${cut.narration ?? ""}`);
    if (!verdict.allowed) {
      return { ok: false, reason: "safety", message: verdict.message! };
    }
  }

  const jobId = `job_${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  const job: GenerationJob = {
    id: jobId,
    userId: input.userId,
    episodeId: storyboard.episodeId,
    seriesId: storyboard.seriesId,
    mode: input.mode,
    status: "queued",
    createdAt: now,
    cuts: storyboard.cuts.map((cut) => ({
      cutId: cut.id,
      index: cut.index,
      status: "queued",
      attempt: 1,
    })),
  };

  jobContext.set(jobId, {
    cuts: new Map(
      storyboard.cuts.map((cut) => [
        cut.id,
        { prompt: buildCutPrompt(storyboard, cut.id), intent: "regenerate" as const },
      ]),
    ),
    characterSheetRefs: input.characterSheetRefs ?? [],
    assetRefs: input.assetRefs ?? [],
    seriesRule: input.seriesRule ?? {},
  });

  await getQueue().submit(job);
  return { ok: true, job: (await getQueue().get(jobId)) ?? job };
}

/** 한 컷 모드 재생성(PRD 3.1.2). 다른 컷 결과는 건드리지 않는다. */
export async function regenerateCut(input: {
  jobId: string;
  cutId: string;
  intent: CutEditIntent;
  prompt?: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (input.prompt) {
    const verdict = screenText(input.prompt);
    if (!verdict.allowed) return { ok: false, message: verdict.message };
  }

  const context = jobContext.get(input.jobId);
  const existing = context?.cuts.get(input.cutId);
  if (context && existing) {
    context.cuts.set(input.cutId, {
      intent: input.intent,
      // 프롬프트를 안 고쳤으면 원래 장면을 그대로 다시 쓴다.
      prompt: input.prompt ? `${existing.prompt}\n요청: ${input.prompt}` : existing.prompt,
    });
  }

  await getQueue().requeue(input.jobId, input.cutId);
  return { ok: true };
}

/** 실패한 컷만 다시 큐에 넣는다. 성공한 컷은 그대로 둔다. */
export async function retryFailedCuts(jobId: string): Promise<void> {
  const job = await getQueue().get(jobId);
  if (!job) return;
  for (const cut of job.cuts) {
    if (cut.status === "failed") await getQueue().requeue(jobId, cut.cutId);
  }
}

export async function getJob(jobId: string): Promise<GenerationJob | null> {
  return getQueue().get(jobId);
}

/**
 * 컷 하나의 이미지 프롬프트. 시리즈 규칙과 캐릭터 레퍼런스는 생성기가 따로 받으므로
 * 여기엔 이 컷에만 해당하는 것만 넣는다.
 */
function buildCutPrompt(storyboard: Storyboard, cutId: string): string {
  const cut = storyboard.cuts.find((c) => c.id === cutId);
  if (!cut) return "";
  return [cut.scene, cut.narration].filter(Boolean).join(" / ");
}
