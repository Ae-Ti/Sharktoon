/**
 * 생성 파이프라인 — PRD 3.1.
 *
 * 콘티 → 큐 등록 → 컷별 생성 → 성공하면 commit, 실패하면 refund 까지를 묶는다.
 * 큐와 생성기는 인터페이스 뒤에 있으므로 여기 코드는 둘이 바뀌어도 그대로 간다.
 *
 * hold 는 **컷마다** 건다. 잡 단위로 한 번에 잡으면 "6컷 중 4컷 성공"에서
 * 얼마를 돌려줘야 하는지가 원장에 남지 않는다.
 *
 * 큐: 실제 저장소 모드는 Supabase 큐(오픈 이슈 11 결정), 목 모드는 인메모리 큐.
 * 작업자는 요청 밖에서 돈다 — 크레딧 주인은 세션이 아니라 잡의 userId 이고,
 * 정산·컷 저장은 서비스 롤로 한다(마이그레이션 0005·0006).
 */

import "server-only";

import { CREDIT_COST, CREDIT_SQLSTATE, InsufficientCreditError } from "@/contracts/credit";
import {
  CREDIT_REASON_BY_INTENT,
  type CutEditIntent,
  type GenerationJob,
  type GenerationMode,
} from "@/contracts/generation";
import { getRepository } from "@/features/platform/data";
import { dataSource } from "@/lib/supabase/env";
import { processSingleton } from "@/lib/singleton";
import { getGenerationStore } from "./data";
import { saveMockJob } from "./data/mock";
import { getImageGenerator } from "./image";
import { createMemoryQueue } from "./queue/memory";
import {
  MAX_ACTIVE_JOBS_PER_USER,
  type CutRunner,
  type CutWork,
  type JobContext,
  type JobQueue,
} from "./queue/types";
import { screenText } from "./safety/rules";
import { CAMERA_LABEL, EMOTION_LABEL, characterName, type Storyboard } from "./types/storyboard";

/** 실패 사유와 함께 "크레딧을 돌려줬는지"를 큐에 알린다. 화면 문구가 이걸 본다. */
class CutFailure extends Error {
  constructor(
    message: string,
    readonly refunded: boolean,
  ) {
    super(message);
  }
}

function amountFor(intent: CutEditIntent) {
  const reason = CREDIT_REASON_BY_INTENT[intent];
  return {
    reason,
    amount: reason === "cut_image" ? CREDIT_COST.cutImage : CREDIT_COST.partialRegenerate,
  };
}

/** 컷 하나를 만드는 일. 크레딧 hold/commit/refund 가 여기서 닫힌다. */
const runCut: CutRunner = async (work: CutWork) => {
  const repo = await getRepository();
  const store = await getGenerationStore();
  const { reason, amount } = amountFor(work.intent);

  // 앞선 작업자가 죽으면서 잡아 둔 크레딧. 이미 정산됐으면(SK002) 그냥 지나간다.
  if (work.staleHoldId) {
    try {
      await repo.refundCredit(work.staleHoldId, "작업자 중단");
    } catch (e) {
      if ((e as { code?: string }).code !== CREDIT_SQLSTATE.holdAlreadyResolved) {
        console.error("[generation] 남은 hold 환불 실패", work.staleHoldId, e);
      }
    }
  }

  // 생성 요청 직전에 잡는다. 모자라면 아무것도 잡히지 않았으니 돌려줄 것도 없다.
  let holdId: string;
  try {
    holdId = await repo.holdCredit({ userId: work.job.userId, amount, reason, jobId: work.job.id });
  } catch (e) {
    throw new CutFailure(e instanceof Error ? e.message : "크레딧을 잡지 못했어요", false);
  }
  await work.onHold?.(holdId);

  try {
    const result = await getImageGenerator().generateCut({
      cutId: work.cut.cutId,
      index: work.cut.index,
      episodeId: work.job.episodeId,
      seriesId: work.job.seriesId ?? "",
      intent: work.intent,
      prompt: work.prompt,
      characterSheetRefs: work.characterSheetRefs,
      assetRefs: work.assetRefs,
      seriesRule: work.seriesRule,
    });
    // 저장까지 끝나야 성공이다. 저장이 실패하면 사용자는 컷을 못 보므로 환불한다.
    const saved = await store.workerSaveCutImage({
      ownerId: work.job.userId,
      episodeId: work.job.episodeId,
      cutId: work.cut.cutId,
      index: work.cut.index,
      imageUrl: result.imageUrl,
      meta: { ...result.metadata, intent: work.intent, attempt: work.cut.attempt },
    });
    await repo.commitCredit(holdId);
    return saved;
  } catch (e) {
    // 실패한 요청의 크레딧은 자동 환불한다(PRD 3.1.1 예외).
    const message = e instanceof Error ? e.message : "생성 실패";
    await repo.refundCredit(holdId, message);
    throw new CutFailure(message, true);
  }
};

/** 모든 컷이 나오면 "첫 화 완성"(운영 깔때기 4단계)이다. */
async function onSettled(job: GenerationJob) {
  if (job.cuts.length > 0 && job.cuts.every((c) => c.status === "done")) {
    try {
      await (await getGenerationStore()).workerSetEpisodeStatus(job.episodeId, "ready");
    } catch (e) {
      console.error("[generation] 회차 상태 갱신 실패", job.episodeId, e);
    }
  }
}

// 서버 액션과 라우트 핸들러는 dev 에서 모듈 인스턴스가 따로 뜬다. 프로세스 전역에 둔다.
const state = processSingleton("generation-pipeline", () => ({
  queue: null as JobQueue | null,
  kind: null as "memory" | "supabase" | null,
}));

async function getQueue(): Promise<JobQueue> {
  const kind = dataSource() === "mock" ? "memory" : "supabase";
  if (state.queue && state.kind === kind) return state.queue;

  if (kind === "memory") {
    state.queue = createMemoryQueue(runCut, {
      onChange: (job, event) => {
        saveMockJob(job);
        if (event === "settle") void onSettled(job);
      },
    });
  } else {
    const { createSupabaseQueue } = await import("./queue/supabase");
    state.queue = createSupabaseQueue(runCut, { onSettled });
  }
  state.kind = kind;
  return state.queue;
}

/**
 * 쌓인 생성 작업을 처리한다. 요청이 끝난 뒤(`after`)와 크론 라우트가 부른다.
 * 처리한 컷 수를 돌려준다. 목 모드에서는 큐가 스스로 돌아 할 일이 없다.
 */
export async function drainQueue(budgetMs = 240_000): Promise<number> {
  return (await getQueue()).drain(budgetMs);
}

export interface StartGenerationInput {
  userId: string;
  storyboard: Storyboard;
  mode: GenerationMode;
  characterAssetIds?: string[];
  assetIds?: string[];
  characterSheetRefs?: string[];
  assetRefs?: string[];
  seriesRule?: Record<string, unknown>;
}

export type StartGenerationResult =
  | { ok: true; job: GenerationJob }
  | { ok: false; reason: "safety"; message: string }
  | { ok: false; reason: "limit"; message: string }
  | { ok: false; reason: "error"; message: string };

/**
 * 에이전트 모드 전체 생성. 콘티의 모든 컷을 큐에 등록한다(PRD 3.1.1).
 * 잔량이 전체 비용보다 적으면 InsufficientCreditError 를 던진다 — 화면이 충전 시트를 연다.
 */
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

  const queue = await getQueue();
  if ((await queue.countActive(input.userId)) >= MAX_ACTIVE_JOBS_PER_USER) {
    return {
      ok: false,
      reason: "limit",
      message: `동시에 ${MAX_ACTIVE_JOBS_PER_USER}화까지 만들 수 있어요. 진행 중인 화가 끝나면 다시 눌러 주세요.`,
    };
  }

  // 컷마다 hold 를 걸지만, 시작 전에 전체 비용을 먼저 본다. 안 그러면 3크레딧으로
  // 6컷을 시작해 3컷만 나오고 나머지는 "크레딧 부족"으로 실패한다(2026-10-02 실 테스트).
  const required = storyboard.cuts.length * CREDIT_COST.cutImage;
  const { balance } = await (await getRepository()).getCredit();
  if (balance < required) throw new InsufficientCreditError(required, balance);

  const now = new Date().toISOString();
  const job: GenerationJob = {
    id: `job_${crypto.randomUUID()}`,
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

  const context: JobContext = {
    cuts: Object.fromEntries(
      storyboard.cuts.map((cut) => [
        cut.id,
        { prompt: buildCutPrompt(storyboard, cut.id), intent: "regenerate" as const },
      ]),
    ),
    characterAssetIds: input.characterAssetIds ?? [],
    assetIds: input.assetIds ?? [],
    characterSheetRefs: input.characterSheetRefs ?? [],
    assetRefs: input.assetRefs ?? [],
    seriesRule: input.seriesRule ?? {},
  };

  const store = await getGenerationStore();
  await store.workerSetEpisodeStatus(storyboard.episodeId, "generating");
  await queue.submit(job, context);
  return { ok: true, job: (await queue.get(job.id)) ?? job };
}

/** 잡 주인 확인. 큐는 서비스 롤로 읽으므로 RLS 가 막아 주지 않는다. */
async function ownedJob(jobId: string, userId: string): Promise<GenerationJob | null> {
  const job = await (await getQueue()).get(jobId);
  return job && job.userId === userId ? job : null;
}

/** 한 컷 모드 재생성(PRD 3.1.2). 다른 컷 결과는 건드리지 않는다. */
export async function regenerateCut(input: {
  jobId: string;
  userId: string;
  cutId: string;
  intent: CutEditIntent;
  prompt?: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (input.prompt) {
    const verdict = screenText(input.prompt);
    if (!verdict.allowed) return { ok: false, message: verdict.message };
  }

  const job = await ownedJob(input.jobId, input.userId);
  if (!job) return { ok: false, message: "이 생성 기록을 찾지 못했어요" };
  const cut = job.cuts.find((c) => c.cutId === input.cutId);
  if (!cut) return { ok: false, message: "이 회차의 컷이 아니에요" };
  if (cut.status === "queued" || cut.status === "running") {
    return { ok: false, message: "이 컷은 지금 만드는 중이에요" };
  }

  const { amount } = amountFor(input.intent);
  const { balance } = await (await getRepository()).getCredit();
  if (balance < amount) throw new InsufficientCreditError(amount, balance);

  await (await getQueue()).requeue(input.jobId, input.cutId, {
    intent: input.intent,
    request: input.prompt,
  });
  return { ok: true };
}

/** 실패한 컷만 다시 큐에 넣는다. 성공한 컷은 그대로 둔다. */
export async function retryFailedCuts(input: {
  jobId: string;
  userId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const job = await ownedJob(input.jobId, input.userId);
  if (!job) return { ok: false, message: "이 생성 기록을 찾지 못했어요" };

  const failed = job.cuts.filter((c) => c.status === "failed");
  const required = failed.length * CREDIT_COST.cutImage;
  const { balance } = await (await getRepository()).getCredit();
  if (balance < required) throw new InsufficientCreditError(required, balance);

  const queue = await getQueue();
  for (const cut of failed) await queue.requeue(input.jobId, cut.cutId);
  return { ok: true };
}

/** 화면이 보는 잡. 소유자가 아니면 null. */
export async function getJob(jobId: string, userId: string | null): Promise<GenerationJob | null> {
  return userId ? ownedJob(jobId, userId) : null;
}

/**
 * 컷 하나의 이미지 프롬프트. 시리즈 규칙과 캐릭터 레퍼런스는 생성기가 따로 받으므로
 * 여기엔 이 컷에만 해당하는 것만 넣는다. 글자는 이미지에 굽지 않는다(PRD 비목표) —
 * 대사·나레이션은 편집기의 벡터 레이어가 된다.
 */
export function buildCutPrompt(storyboard: Storyboard, cutId: string): string {
  const cut = storyboard.cuts.find((c) => c.id === cutId);
  if (!cut) return "";
  const who = cut.characterIds.map((k) => characterName(storyboard, k)).join(", ");
  return [
    cut.scene,
    who ? `등장: ${who}` : null,
    `감정: ${EMOTION_LABEL[cut.emotion]}`,
    `카메라: ${CAMERA_LABEL[cut.camera]}`,
    "말풍선과 글자는 그리지 않는다",
  ]
    .filter(Boolean)
    .join(" / ");
}
