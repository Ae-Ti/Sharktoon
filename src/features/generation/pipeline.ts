/**
 * 생성 파이프라인 — 오너: 웅싯(A). PRD 3.1.
 *
 * 콘티 → 큐 등록 → 컷별 생성 → 성공하면 commit, 실패하면 refund 까지를 묶는다.
 * 큐와 생성기는 인터페이스 뒤에 있으므로 여기 코드는 둘이 바뀌어도 그대로 간다.
 *
 * hold 는 **컷마다** 건다. 잡 단위로 한 번에 잡으면 "6컷 중 4컷 성공"에서
 * 얼마를 돌려줘야 하는지가 원장에 남지 않는다.
 *
 * 워커는 사용자 요청 밖에서 돈다. 크레딧 주인은 세션이 아니라 잡의 userId 이고,
 * 정산·컷 저장은 서비스 롤로 한다(마이그레이션 0005·0006).
 */

import "server-only";

import { CREDIT_COST, InsufficientCreditError } from "@/contracts/credit";
import {
  CREDIT_REASON_BY_INTENT,
  type CutEditIntent,
  type GenerationJob,
  type GenerationMode,
} from "@/contracts/generation";
import { getRepository } from "@/features/platform/data";
import { processSingleton } from "@/lib/singleton";
import { getGenerationStore } from "./data";
import { getImageGenerator } from "./image";
import { createMemoryQueue } from "./queue/memory";
import { MAX_ACTIVE_JOBS_PER_USER, type JobQueue } from "./queue/types";
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

/** 컷 하나를 만드는 일. 크레딧 hold/commit/refund 가 여기서 닫힌다. */
async function generateOneCut({
  job,
  cut,
}: {
  job: GenerationJob;
  cut: GenerationJob["cuts"][number];
}) {
  const repo = await getRepository();
  const store = await getGenerationStore();
  const generator = getImageGenerator();

  const context = state.contexts.get(job.id);
  const cutContext = context?.cuts.get(cut.cutId);
  const intent: CutEditIntent = cutContext?.intent ?? "regenerate";
  const reason = CREDIT_REASON_BY_INTENT[intent];
  const amount =
    reason === "cut_image" ? CREDIT_COST.cutImage : CREDIT_COST.partialRegenerate;

  // 생성 요청 직전에 잡는다. 모자라면 아무것도 잡히지 않았으니 돌려줄 것도 없다.
  let holdId: string;
  try {
    holdId = await repo.holdCredit({ userId: job.userId, amount, reason, jobId: job.id });
  } catch (e) {
    throw new CutFailure(e instanceof Error ? e.message : "크레딧을 잡지 못했어요", false);
  }

  try {
    const result = await generator.generateCut({
      cutId: cut.cutId,
      index: cut.index,
      episodeId: job.episodeId,
      seriesId: job.seriesId ?? "",
      intent,
      prompt: cutContext?.prompt ?? "",
      characterSheetRefs: context?.characterSheetRefs ?? [],
      assetRefs: context?.assetRefs ?? [],
      seriesRule: context?.seriesRule ?? {},
    });
    // 저장까지 끝나야 성공이다. 저장이 실패하면 사용자는 컷을 못 보므로 환불한다.
    const saved = await store.workerSaveCutImage({
      ownerId: job.userId,
      episodeId: job.episodeId,
      cutId: cut.cutId,
      index: cut.index,
      imageUrl: result.imageUrl,
      meta: { ...result.metadata, intent, attempt: cut.attempt },
    });
    await repo.commitCredit(holdId);
    return saved;
  } catch (e) {
    // 실패한 요청의 크레딧은 자동 환불한다(PRD 3.1.1 예외).
    const message = e instanceof Error ? e.message : "생성 실패";
    await repo.refundCredit(holdId, message);
    throw new CutFailure(message, true);
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

// 서버 액션과 라우트 핸들러는 dev 에서 모듈 인스턴스가 따로 뜬다. 프로세스 전역에 둔다.
const state = processSingleton("generation-pipeline", () => ({
  contexts: new Map<string, JobContext>(),
  queue: null as JobQueue | null,
}));

function getQueue(): JobQueue {
  state.queue ??= createMemoryQueue(generateOneCut, {
    onChange: (job, event) => void persist(job, event),
  });
  return state.queue;
}

/** 잡 사본을 저장하고, 끝났으면 회차 상태를 올린다. 실패해도 생성은 멈추지 않는다. */
async function persist(job: GenerationJob, event: "submit" | "cut" | "settle") {
  try {
    const store = await getGenerationStore();
    await store.workerSaveJob(job);
    if (event === "settle" && job.cuts.every((c) => c.status === "done")) {
      // 모든 컷에 이미지가 있으면 "첫 화 완성"이다(운영 깔때기 4단계).
      await store.workerSetEpisodeStatus(job.episodeId, "ready");
    }
  } catch (e) {
    console.error("[generation] 잡 저장 실패", job.id, e);
  }
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

  if ((await getQueue().countActive(input.userId)) >= MAX_ACTIVE_JOBS_PER_USER) {
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

  const jobId = `job_${crypto.randomUUID()}`;
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

  state.contexts.set(jobId, contextFor(storyboard, input));

  const store = await getGenerationStore();
  await store.workerSetEpisodeStatus(storyboard.episodeId, "generating");
  await getQueue().submit(job);
  return { ok: true, job: (await getQueue().get(jobId)) ?? job };
}

function contextFor(
  storyboard: Storyboard,
  input: Pick<StartGenerationInput, "characterSheetRefs" | "assetRefs" | "seriesRule">,
): JobContext {
  return {
    cuts: new Map(
      storyboard.cuts.map((cut) => [
        cut.id,
        { prompt: buildCutPrompt(storyboard, cut.id), intent: "regenerate" as const },
      ]),
    ),
    characterSheetRefs: input.characterSheetRefs ?? [],
    assetRefs: input.assetRefs ?? [],
    seriesRule: input.seriesRule ?? {},
  };
}

/**
 * 메모리에 없는 잡(서버 재시작 뒤)을 저장소에서 다시 올린다.
 * 저장소 읽기는 사용자 세션(RLS)이라 남의 잡은 여기서 걸러진다.
 */
async function ensureLoaded(
  jobId: string,
  userId: string,
  restoreInput: () => Promise<Omit<StartGenerationInput, "userId" | "mode"> | null>,
): Promise<GenerationJob | null> {
  const queue = getQueue();
  const live = await queue.get(jobId);
  if (live) return live.userId === userId ? live : null;

  const store = await getGenerationStore();
  const saved = await store.getJob(jobId);
  if (!saved || saved.userId !== userId) return null;

  const input = await restoreInput();
  if (input) state.contexts.set(jobId, contextFor(input.storyboard, input));

  // 워커가 사라진 채 잡혀 있던 hold 를 먼저 돌려준다.
  const stuck = saved.cuts.filter((c) => c.status === "queued" || c.status === "running");
  if (stuck.length > 0) {
    await (await getRepository()).refundOpenHolds(jobId, "서버 재시작으로 중단");
  }
  await queue.restore({
    ...saved,
    cuts: saved.cuts.map((c) =>
      c.status === "queued" || c.status === "running" ? { ...c, refunded: true } : c,
    ),
  });
  return queue.get(jobId);
}

export interface JobOwnerInput {
  jobId: string;
  userId: string;
  /** 재시작 뒤 컨텍스트를 다시 만들 재료. 콘티와 시리즈 규칙. */
  restore: () => Promise<Omit<StartGenerationInput, "userId" | "mode"> | null>;
}

/** 한 컷 모드 재생성(PRD 3.1.2). 다른 컷 결과는 건드리지 않는다. */
export async function regenerateCut(
  input: JobOwnerInput & { cutId: string; intent: CutEditIntent; prompt?: string },
): Promise<{ ok: boolean; message?: string }> {
  if (input.prompt) {
    const verdict = screenText(input.prompt);
    if (!verdict.allowed) return { ok: false, message: verdict.message };
  }

  const job = await ensureLoaded(input.jobId, input.userId, input.restore);
  if (!job) return { ok: false, message: "이 생성 기록을 찾지 못했어요" };
  if (!job.cuts.some((c) => c.cutId === input.cutId)) {
    return { ok: false, message: "이 회차의 컷이 아니에요" };
  }

  const reason = CREDIT_REASON_BY_INTENT[input.intent];
  const amount = reason === "cut_image" ? CREDIT_COST.cutImage : CREDIT_COST.partialRegenerate;
  const { balance } = await (await getRepository()).getCredit();
  if (balance < amount) throw new InsufficientCreditError(amount, balance);

  const context = state.contexts.get(input.jobId);
  const existing = context?.cuts.get(input.cutId);
  if (context && existing) {
    context.cuts.set(input.cutId, {
      intent: input.intent,
      // 프롬프트를 안 고쳤으면 원래 장면을 그대로 다시 쓴다.
      prompt: input.prompt ? `${baseOf(existing.prompt)}\n요청: ${input.prompt}` : baseOf(existing.prompt),
    });
  }

  await getQueue().requeue(input.jobId, input.cutId);
  return { ok: true };
}

/** 한 컷 모드 요청을 여러 번 하면 "요청:" 이 쌓인다. 원래 장면만 남긴다. */
function baseOf(prompt: string): string {
  return prompt.split("\n요청: ")[0];
}

/** 실패한 컷만 다시 큐에 넣는다. 성공한 컷은 그대로 둔다. */
export async function retryFailedCuts(input: JobOwnerInput): Promise<{ ok: boolean; message?: string }> {
  const job = await ensureLoaded(input.jobId, input.userId, input.restore);
  if (!job) return { ok: false, message: "이 생성 기록을 찾지 못했어요" };

  const failed = job.cuts.filter((c) => c.status === "failed");
  const required = failed.length * CREDIT_COST.cutImage;
  const { balance } = await (await getRepository()).getCredit();
  if (balance < required) throw new InsufficientCreditError(required, balance);

  for (const cut of failed) await getQueue().requeue(input.jobId, cut.cutId);
  return { ok: true };
}

/**
 * 화면이 보는 잡. 메모리에 있으면(진행 중) 그걸, 없으면 저장된 사본을 준다.
 * 메모리 잡은 RLS 를 거치지 않으므로 소유자를 여기서 확인한다.
 */
export async function getJob(jobId: string, userId: string | null): Promise<GenerationJob | null> {
  const live = await getQueue().get(jobId);
  if (live) return userId && live.userId === userId ? live : null;
  return (await getGenerationStore()).getJob(jobId);
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
