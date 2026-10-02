/**
 * 인메모리 큐 — 오픈 이슈 11 이 끝나기 전까지의 구현.
 *
 * **프로세스 안에서만 산다.** 서버가 재시작하면 돌던 잡이 사라지고,
 * 인스턴스가 둘이면 다른 인스턴스의 잡을 못 본다. 개발과 목업에는 충분하고
 * 프로덕션에는 못 쓴다 — 그래서 `JobQueue` 뒤에 숨겨 두었다.
 */

import {
  summarizeJob,
  type GenerationJob,
  type GenerationJobCut,
  type JobStatus,
} from "@/contracts/generation";
import { CUT_CONCURRENCY, type JobQueue, type QueueHooks } from "./types";

export interface CutWorkerInput {
  job: GenerationJob;
  cut: GenerationJobCut;
}

export interface CutWorkerResult {
  imageUrl: string;
  imageRef?: string;
}

/** 컷 하나를 실제로 만드는 일. 파이프라인이 크레딧까지 묶어서 넘긴다. */
export type CutWorker = (input: CutWorkerInput) => Promise<CutWorkerResult>;

export function createMemoryQueue(worker: CutWorker, hooks: QueueHooks = {}): JobQueue {
  const jobs = new Map<string, GenerationJob>();
  /** 잡마다 아직 안 끝난 컷 대기열. */
  const pending = new Map<string, string[]>();
  const running = new Map<string, number>();

  function patchCut(jobId: string, cutId: string, patch: Partial<GenerationJobCut>) {
    const job = jobs.get(jobId);
    if (!job) return;
    jobs.set(jobId, {
      ...job,
      cuts: job.cuts.map((c) => (c.cutId === cutId ? { ...c, ...patch } : c)),
    });
  }

  function emit(jobId: string, event: "submit" | "cut" | "settle") {
    const job = jobs.get(jobId);
    if (job) hooks.onChange?.(job, event);
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
    if (!job || !cut) return;

    patchCut(jobId, cutId, {
      status: "running",
      progress: 0,
      startedAt: new Date().toISOString(),
      error: undefined,
    });

    // 모델이 중간 진행률을 주지 않으므로 화면이 멈춘 것처럼 보이지 않게 추정치를 올린다.
    // 80% 에서 멈춰 세운다 — 끝나지 않았는데 100% 를 보여주면 그게 더 나쁘다.
    const ticker = setInterval(() => {
      const current = jobs.get(jobId)?.cuts.find((c) => c.cutId === cutId);
      if (!current || current.status !== "running") return;
      patchCut(jobId, cutId, { progress: Math.min(80, (current.progress ?? 0) + 8) });
    }, 400);

    try {
      const { imageUrl, imageRef } = await worker({ job, cut });
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
        // 크레딧을 잡기 전에 막혔으면(잔량 부족) 돌려줄 것이 없다. 워커가 알려준다.
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
    async submit(job) {
      jobs.set(job.id, { ...job, status: "running" });
      pending.set(job.id, job.cuts.filter((c) => c.status === "queued").map((c) => c.cutId));
      running.set(job.id, 0);
      emit(job.id, "submit");
      pump(job.id);
    },

    async requeue(jobId, cutId) {
      const job = jobs.get(jobId);
      const cut = job?.cuts.find((c) => c.cutId === cutId);
      if (!job || !cut || cut.status === "running") return;

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

    async restore(job) {
      if (jobs.has(job.id)) return;
      // 서버가 재시작되면 돌던 컷은 주인을 잃는다. 실패로 돌려 사용자가 다시 누르게 한다.
      // 크레딧은 hold 가 남아 있을 수 있다 — 정산 배치(운영)가 오래된 hold 를 환불한다.
      jobs.set(job.id, {
        ...job,
        cuts: job.cuts.map((c) =>
          c.status === "queued" || c.status === "running"
            ? { ...c, status: "failed", error: "서버가 다시 시작돼 멈췄어요. 다시 눌러 주세요." }
            : c,
        ),
      });
      running.set(job.id, 0);
      settleJob(job.id);
    },

    async countActive(userId) {
      return [...jobs.values()].filter(
        (j) => j.userId === userId && (j.status === "queued" || j.status === "running"),
      ).length;
    },
  };
}
