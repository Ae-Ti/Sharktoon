/**
 * 인메모리 큐 — 목 모드(`npm run dev:mock`)와 검증 스크립트용.
 *
 * **프로세스 안에서만 산다.** 서버가 재시작하면 돌던 잡이 사라지고, 인스턴스가 둘이면
 * 다른 인스턴스의 잡을 못 본다. 실제 저장소 모드에서는 Supabase 큐(`supabase.ts`)를 쓴다.
 */

import {
  summarizeJob,
  type GenerationJob,
  type GenerationJobCut,
  type JobStatus,
} from "@/contracts/generation";
import {
  CUT_CONCURRENCY,
  withRequest,
  type CutRunner,
  type JobContext,
  type JobQueue,
} from "./types";

export interface MemoryQueueHooks {
  /** 등록·컷 종료·잡 종료처럼 상태가 실제로 바뀔 때. 진행률 틱마다 부르지 않는다. */
  onChange?: (job: GenerationJob, event: "submit" | "cut" | "settle") => void;
}

export function createMemoryQueue(runner: CutRunner, hooks: MemoryQueueHooks = {}): JobQueue {
  const jobs = new Map<string, GenerationJob>();
  const contexts = new Map<string, JobContext>();
  /** 잡마다 아직 안 끝난 컷 대기열. */
  const pending = new Map<string, string[]>();
  const running = new Map<string, number>();

  function emit(jobId: string, event: "submit" | "cut" | "settle") {
    const job = jobs.get(jobId);
    if (job) hooks.onChange?.(job, event);
  }

  function patchCut(jobId: string, cutId: string, patch: Partial<GenerationJobCut>) {
    const job = jobs.get(jobId);
    if (!job) return;
    jobs.set(jobId, {
      ...job,
      cuts: job.cuts.map((c) => (c.cutId === cutId ? { ...c, ...patch } : c)),
    });
  }

  /** 컷 상태에서 잡 상태를 다시 센다. 두 곳에서 따로 세면 어긋난다. */
  function settleJob(jobId: string) {
    const job = jobs.get(jobId);
    if (!job) return;
    const s = summarizeJob(job);
    if (s.running > 0 || s.queued > 0) return;

    const status: JobStatus =
      s.failed === 0 ? "succeeded" : s.done === 0 ? "failed" : "partially_failed";
    jobs.set(jobId, { ...job, status, finishedAt: new Date().toISOString() });
    emit(jobId, "settle");
  }

  function pump(jobId: string) {
    const queue = pending.get(jobId);
    if (!queue) return;

    while ((running.get(jobId) ?? 0) < CUT_CONCURRENCY && queue.length > 0) {
      const cutId = queue.shift()!;
      running.set(jobId, (running.get(jobId) ?? 0) + 1);
      void runCut(jobId, cutId);
    }
  }

  async function runCut(jobId: string, cutId: string) {
    const job = jobs.get(jobId);
    const cut = job?.cuts.find((c) => c.cutId === cutId);
    const context = contexts.get(jobId);
    const work = context?.cuts[cutId];
    if (!job || !cut || !context || !work) return;

    patchCut(jobId, cutId, {
      status: "running",
      progress: 0,
      startedAt: new Date().toISOString(),
      error: undefined,
    });

    // 모델이 중간 진행률을 주지 않으므로 화면이 멈춘 것처럼 보이지 않게 추정치를 올린다.
    const ticker = setInterval(() => {
      const current = jobs.get(jobId)?.cuts.find((c) => c.cutId === cutId);
      if (!current || current.status !== "running") return;
      patchCut(jobId, cutId, { progress: Math.min(80, (current.progress ?? 0) + 8) });
    }, 400);

    try {
      const { imageUrl, imageRef } = await runner({
        job,
        cut,
        intent: work.intent,
        prompt: work.prompt,
        characterSheetRefs: context.characterSheetRefs,
        assetRefs: context.assetRefs,
        seriesRule: context.seriesRule,
      });
      patchCut(jobId, cutId, {
        status: "done",
        progress: 100,
        imageUrl,
        imageRef,
        refunded: undefined,
        finishedAt: new Date().toISOString(),
      });
    } catch (e) {
      patchCut(jobId, cutId, {
        status: "failed",
        progress: undefined,
        error: e instanceof Error ? e.message : "이미지를 못 만들었어요",
        // 크레딧을 잡기 전에 막혔으면(잔량 부족) 돌려줄 것이 없다. 작업자가 알려준다.
        refunded: (e as { refunded?: boolean } | null)?.refunded === true,
        finishedAt: new Date().toISOString(),
      });
    } finally {
      clearInterval(ticker);
      running.set(jobId, Math.max(0, (running.get(jobId) ?? 1) - 1));
      emit(jobId, "cut");
      settleJob(jobId);
      pump(jobId);
    }
  }

  return {
    async submit(job, context) {
      jobs.set(job.id, { ...job, status: "running" });
      contexts.set(job.id, structuredClone(context));
      pending.set(job.id, job.cuts.filter((c) => c.status === "queued").map((c) => c.cutId));
      running.set(job.id, 0);
      emit(job.id, "submit");
      pump(job.id);
    },

    async requeue(jobId, cutId, change) {
      const job = jobs.get(jobId);
      const cut = job?.cuts.find((c) => c.cutId === cutId);
      const context = contexts.get(jobId);
      if (!job || !cut || !context || cut.status === "running" || cut.status === "queued") return;

      const prev = context.cuts[cutId];
      if (prev && change) {
        context.cuts[cutId] = { intent: change.intent, prompt: withRequest(prev.prompt, change.request) };
      }

      jobs.set(jobId, {
        ...job,
        status: "running",
        finishedAt: undefined,
        cuts: job.cuts.map((c) =>
          c.cutId === cutId
            ? { ...c, status: "queued", error: undefined, refunded: undefined, attempt: c.attempt + 1 }
            : c,
        ),
      });
      const queued = pending.get(jobId);
      if (queued) queued.push(cutId);
      else pending.set(jobId, [cutId]);
      emit(jobId, "submit");
      pump(jobId);
    },

    async get(jobId) {
      return jobs.get(jobId) ?? null;
    },

    async countActive(userId) {
      return [...jobs.values()].filter(
        (j) => j.userId === userId && (j.status === "queued" || j.status === "running"),
      ).length;
    },

    async drain() {
      return 0;
    },
  };
}
