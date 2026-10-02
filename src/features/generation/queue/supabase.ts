import "server-only";

/**
 * Supabase 큐 — 오픈 이슈 11 결정(2026-10-03). 마이그레이션 0007.
 *
 * 생성 요청은 generation_tasks 테이블에 "할 일" 행으로 적는다. 작업자(`drain`)는
 * `claim_generation_tasks()` 로 몇 개를 꺼내 처리하고 결과를 같은 행에 적는다.
 * 작업자는 웹 서버 안에서 돈다 — 요청을 보낸 뒤(`after`), 진행률 폴링이 멈춘 잡을 볼 때,
 * 그리고 Supabase pg_cron 이 1분마다 `/api/queue/run` 을 부를 때. 별도 서버가 필요 없다.
 *
 * 서버가 중간에 꺼져도 할 일 행은 남는다. 작업자가 쥐고 있던 행은 임대 시간(3분)이 지나면
 * 다른 작업자가 다시 가져가고, 그때 죽은 작업자가 잡아 둔 크레딧을 먼저 돌려준다.
 */

import type { GenerationJob } from "@/contracts/generation";
import { resolveImages } from "@/features/platform/data/images";
import type { Json } from "@/lib/supabase/database.types";
import { createServiceClient } from "@/lib/supabase/service";
import { buildJobView, latestPerCut, statusOf, type JobRowLike, type TaskRowLike } from "./jobView";
import { CUT_CONCURRENCY, withRequest, type CutRunner, type JobContext, type JobQueue } from "./types";

/** 한 번에 꺼내는 수. 이미지 API 동시 호출 상한이기도 하다. */
const CLAIM_LIMIT = 4;
/** 작업자가 컷 하나를 쥐는 시간. 컷 생성 + 저장보다 넉넉해야 한다. */
const LEASE_SECONDS = 180;
/** 남은 시간이 이보다 적으면 새로 꺼내지 않는다(컷 하나를 끝낼 시간). */
const MIN_SLICE_MS = 60_000;

const TASK_COLUMNS =
  "id, job_id, owner_id, episode_id, cut_id, index, intent, prompt, attempt, status, hold_id, image_ref, error, refunded, started_at, finished_at";

type StoredContext = Pick<JobContext, "characterAssetIds" | "assetIds" | "seriesRule"> & {
  seriesId: string;
};

export function createSupabaseQueue(runner: CutRunner, hooks: { onSettled?: (job: GenerationJob) => Promise<void> } = {}): JobQueue {
  async function readJob(jobId: string) {
    const db = createServiceClient();
    const [{ data: job }, { data: tasks }] = await Promise.all([
      db.from("generation_jobs").select("id, owner_id, episode_id, mode, status, created_at, finished_at, context").eq("id", jobId).maybeSingle(),
      db.from("generation_tasks").select(TASK_COLUMNS).eq("job_id", jobId).order("id"),
    ]);
    return job ? { job: job as JobRowLike, tasks: (tasks ?? []) as (TaskRowLike & { owner_id: string; prompt: string; intent: string })[] } : null;
  }

  async function view(jobId: string): Promise<GenerationJob | null> {
    const found = await readJob(jobId);
    if (!found) return null;
    const refs = found.tasks.map((t) => t.image_ref).filter((r): r is string => Boolean(r));
    const urls = await resolveImages("cuts", found.job.owner_id, refs);
    return buildJobView(found.job, found.tasks, (r) => urls.get(r));
  }

  /** 잡의 모든 컷이 끝났으면 잡 상태를 닫는다. */
  async function settle(jobId: string) {
    const found = await readJob(jobId);
    if (!found) return;
    const latest = latestPerCut(found.tasks);
    const status = statusOf(latest);
    if (status === "running") return;
    const db = createServiceClient();
    await db
      .from("generation_jobs")
      .update({ status, finished_at: new Date().toISOString() })
      .eq("id", jobId);
    const settled = await view(jobId);
    if (settled) await hooks.onSettled?.(settled);
  }

  /** 에셋 id → 지금 서명한 레퍼런스 URL. 소유자의 에셋만. */
  async function refsOf(ownerId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const db = createServiceClient();
    const { data } = await db.from("assets").select("id, reference_paths").in("id", ids).eq("owner_id", ownerId);
    const paths = (data ?? []).flatMap((a) => a.reference_paths ?? []);
    const urls = await resolveImages("assets", ownerId, paths);
    return paths.map((p) => urls.get(p)).filter((u): u is string => Boolean(u));
  }

  async function runTask(task: TaskRowLike & { job_id: string; owner_id: string; episode_id: string; prompt: string; intent: string; hold_id: string | null }) {
    const db = createServiceClient();
    try {
      const { data: job } = await db.from("generation_jobs").select("context").eq("id", task.job_id).single();
      const ctx = (job?.context ?? {}) as Partial<StoredContext>;
      const [characterSheetRefs, assetRefs] = await Promise.all([
        refsOf(task.owner_id, ctx.characterAssetIds ?? []),
        refsOf(task.owner_id, ctx.assetIds ?? []),
      ]);

      const result = await runner({
        job: { id: task.job_id, userId: task.owner_id, episodeId: task.episode_id, seriesId: ctx.seriesId ?? "" },
        cut: { cutId: task.cut_id, index: task.index, attempt: task.attempt },
        intent: task.intent as never,
        prompt: task.prompt,
        characterSheetRefs,
        assetRefs,
        seriesRule: ctx.seriesRule ?? {},
        staleHoldId: task.hold_id ?? undefined,
        onHold: async (holdId) => {
          await db.from("generation_tasks").update({ hold_id: holdId }).eq("id", task.id);
        },
      });

      await db
        .from("generation_tasks")
        .update({ status: "done", image_ref: result.imageRef, finished_at: new Date().toISOString(), lease_until: null })
        .eq("id", task.id);
    } catch (e) {
      await db
        .from("generation_tasks")
        .update({
          status: "failed",
          error: e instanceof Error ? e.message : "이미지를 못 만들었어요",
          refunded: (e as { refunded?: boolean } | null)?.refunded === true,
          finished_at: new Date().toISOString(),
          lease_until: null,
        })
        .eq("id", task.id);
    }
    await settle(task.job_id);
  }

  return {
    async submit(job, context) {
      const db = createServiceClient();
      const stored: StoredContext = {
        characterAssetIds: context.characterAssetIds,
        assetIds: context.assetIds,
        seriesRule: context.seriesRule,
        seriesId: job.seriesId,
      };
      const { error } = await db.from("generation_jobs").insert({
        id: job.id,
        owner_id: job.userId,
        episode_id: job.episodeId,
        mode: job.mode,
        status: "running",
        created_at: job.createdAt,
        context: stored as unknown as Json,
      });
      if (error) throw error;
      const { error: taskError } = await db.from("generation_tasks").insert(
        job.cuts.map((c) => ({
          job_id: job.id,
          owner_id: job.userId,
          episode_id: job.episodeId,
          cut_id: c.cutId,
          index: c.index,
          intent: context.cuts[c.cutId]?.intent ?? "regenerate",
          prompt: context.cuts[c.cutId]?.prompt ?? "",
        })),
      );
      if (taskError) throw taskError;
    },

    async requeue(jobId, cutId, change) {
      const found = await readJob(jobId);
      const prev = found ? latestPerCut(found.tasks).find((t) => t.cut_id === cutId) : undefined;
      if (!found || !prev || prev.status === "queued" || prev.status === "running") return;

      const db = createServiceClient();
      const { error } = await db.from("generation_tasks").insert({
        job_id: jobId,
        owner_id: found.job.owner_id,
        episode_id: found.job.episode_id,
        cut_id: cutId,
        index: prev.index,
        intent: change?.intent ?? prev.intent,
        prompt: change ? withRequest(prev.prompt, change.request) : prev.prompt,
        attempt: prev.attempt + 1,
      });
      if (error) throw error;
      await db.from("generation_jobs").update({ status: "running", finished_at: null }).eq("id", jobId);
    },

    get: view,

    async countActive(userId) {
      const db = createServiceClient();
      const { data } = await db
        .from("generation_tasks")
        .select("job_id")
        .eq("owner_id", userId)
        .in("status", ["queued", "running"]);
      return new Set((data ?? []).map((t) => t.job_id)).size;
    },

    async drain(budgetMs) {
      const deadline = Date.now() + budgetMs;
      const db = createServiceClient();
      let processed = 0;
      while (deadline - Date.now() > MIN_SLICE_MS) {
        const { data, error } = await db.rpc("claim_generation_tasks", {
          p_limit: CLAIM_LIMIT,
          p_lease_seconds: LEASE_SECONDS,
          p_per_job: CUT_CONCURRENCY,
        });
        if (error) throw error;
        const tasks = (data ?? []) as Parameters<typeof runTask>[0][];
        if (tasks.length === 0) break;
        await Promise.all(tasks.map(runTask));
        processed += tasks.length;
      }
      return processed;
    },
  };
}
