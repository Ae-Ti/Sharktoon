/**
 * 큐 테이블(generation_jobs + generation_tasks) → 화면이 보는 GenerationJob.
 * 큐와 저장소가 같은 셈을 하게 한 군데 둔다. DB 를 모르는 순수 함수라 검증 스크립트가 직접 부른다.
 */

import type { GenerationJob, GenerationJobCut, JobStatus } from "@/contracts/generation";
import { estimateProgress } from "./types";

export interface JobRowLike {
  id: string;
  owner_id: string;
  episode_id: string;
  mode: string;
  status: JobStatus;
  created_at: string;
  finished_at: string | null;
  context: unknown;
}

export interface TaskRowLike {
  id: number;
  cut_id: string;
  index: number;
  attempt: number;
  status: "queued" | "running" | "done" | "failed";
  image_ref: string | null;
  error: string | null;
  refunded: boolean;
  started_at: string | null;
  finished_at: string | null;
}

/** 컷마다 가장 최근 시도를 고른다. 한 행이 한 번의 시도다. */
export function latestPerCut<T extends TaskRowLike>(tasks: T[]): T[] {
  const latest = new Map<string, T>();
  for (const t of tasks) {
    const prev = latest.get(t.cut_id);
    if (!prev || t.id > prev.id) latest.set(t.cut_id, t);
  }
  return [...latest.values()].sort((a, b) => a.index - b.index);
}

/** 컷 상태로 잡 상태를 센다. 하나라도 남아 있으면 진행 중이다. */
export function statusOf(cuts: Pick<TaskRowLike, "status">[]): JobStatus {
  if (cuts.some((c) => c.status === "queued" || c.status === "running")) return "running";
  const failed = cuts.filter((c) => c.status === "failed").length;
  if (failed === 0) return "succeeded";
  return failed === cuts.length ? "failed" : "partially_failed";
}

export function buildJobView(
  job: JobRowLike,
  tasks: TaskRowLike[],
  urlOf: (ref: string) => string | undefined,
  now = Date.now(),
): GenerationJob {
  const latest = latestPerCut(tasks);
  const cuts: GenerationJobCut[] = latest.map((t) => ({
    cutId: t.cut_id,
    index: t.index,
    status: t.status,
    attempt: t.attempt,
    progress:
      t.status === "running"
        ? estimateProgress(t.started_at ?? undefined, now)
        : t.status === "done"
          ? 100
          : undefined,
    imageRef: t.image_ref ?? undefined,
    imageUrl: t.image_ref ? urlOf(t.image_ref) : undefined,
    error: t.error ?? undefined,
    refunded: t.status === "failed" ? t.refunded : undefined,
    startedAt: t.started_at ?? undefined,
    finishedAt: t.finished_at ?? undefined,
  }));
  const status = cuts.length ? statusOf(latest) : job.status;
  const context = (job.context ?? {}) as { seriesId?: string };
  return {
    id: job.id,
    userId: job.owner_id,
    episodeId: job.episode_id,
    seriesId: context.seriesId ?? "",
    mode: job.mode as GenerationJob["mode"],
    status,
    cuts,
    createdAt: job.created_at,
    finishedAt: status === "running" ? undefined : (job.finished_at ?? undefined),
  };
}
