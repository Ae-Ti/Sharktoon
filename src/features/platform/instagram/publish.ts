import "server-only";

import { IG_CAROUSEL_MAX, IG_CONTAINER_TTL_MS } from "@/contracts/instagram";
import type { Tables } from "@/lib/supabase/database.types";
import { createServiceClient } from "@/lib/supabase/service";
import { removeObjects, signedUrls } from "@/lib/supabase/storage";
import { credentialsFor } from "./accounts";
import { instagramAvailable } from "./config";
import {
  IgApiError,
  containerStatus,
  createCarouselContainer,
  createImageContainer,
  mediaPermalink,
  postComment,
  publishContainer,
  publishingQuota,
} from "./graph";

/**
 * 인스타 발행 작업자. 즉시 발행도 예약 발행도 instagram_publish_jobs 의 한 행이다 —
 * Instagram API 에는 예약 기능이 없어서, 예약 시각이 되면 우리가 직접 발행한다.
 *
 * 흐름(공식 문서 content-publishing):
 *   1. 장마다 이미지 컨테이너(캐러셀이면 is_carousel_item) → 2. 캐러셀 컨테이너(캡션·AI 라벨은 여기만)
 *   3. 상태가 FINISHED 가 될 때까지 기다림 → 4. media_publish → 5. 첫 댓글
 * 컨테이너는 24시간 뒤 만료된다. 작업자가 중간에 죽으면 container_id 로 이어서 상태만 다시 본다.
 * 크론(/api/queue/run, 1분마다)이 깨우고, 발행 요청 직후에도 한 번 돈다.
 */

type Job = Tables<"instagram_publish_jobs">;

/** 이 횟수만큼 꺼냈는데도 못 끝내면 실패로 닫는다. */
const MAX_ATTEMPTS = 8;
/** 한 번 돌 때 컨테이너 상태를 보는 시간. 이미지는 보통 몇 초면 끝난다. 남으면 다음 크론에 이어 본다. */
const POLL_MS = 45_000;
const POLL_EVERY_MS = 5_000;
const CLAIM_LIMIT = 3;
const LEASE_SECONDS = 300;
/** 남은 시간이 이보다 적으면 새로 꺼내지 않는다. */
const MIN_SLICE_MS = 60_000;

export async function drainInstagramPublish(budgetMs = 120_000): Promise<number> {
  if (!instagramAvailable()) return 0;
  const deadline = Date.now() + budgetMs;
  const db = createServiceClient();
  let processed = 0;
  while (deadline - Date.now() > MIN_SLICE_MS) {
    const { data, error } = await db.rpc("claim_instagram_publish_jobs", {
      p_limit: CLAIM_LIMIT,
      p_lease_seconds: LEASE_SECONDS,
    });
    if (error) throw error;
    const jobs = data ?? [];
    if (jobs.length === 0) break;
    // 꺼낸 작업은 계정이 모두 다르다(claim 이 계정당 하나만 준다).
    await Promise.all(jobs.map((job) => runJob(job).catch((e) => console.error("[instagram] 발행 작업 오류", job.id, e))));
    processed += jobs.length;
  }
  return processed;
}

async function update(jobId: string, patch: Partial<Job>) {
  const db = createServiceClient();
  const { error } = await db.from("instagram_publish_jobs").update(patch).eq("id", jobId);
  if (error) throw error;
}

/** 다음에 다시 꺼내도록 돌려놓는다. container_id 는 그대로 둔다. */
function later(job: Job, delayMs: number, message: string | null) {
  return update(job.id, {
    status: "queued",
    lease_until: null,
    scheduled_at: new Date(Date.now() + delayMs).toISOString(),
    error: message,
  });
}

function fail(job: Job, message: string) {
  return update(job.id, { status: "failed", lease_until: null, error: message });
}

async function runJob(job: Job): Promise<void> {
  if (job.attempts > MAX_ATTEMPTS) {
    return fail(job, job.error ?? "여러 번 시도했지만 발행하지 못했어요.");
  }
  const creds = await credentialsFor(job.owner_id);
  if (!creds) return fail(job, "인스타그램 연결이 끊겼거나 만료됐어요. 다시 연결한 뒤 발행해 주세요.");

  try {
    let containerId = job.container_id;
    const containerAge = job.container_created_at ? Date.now() - new Date(job.container_created_at).getTime() : Infinity;
    if (containerId && containerAge > IG_CONTAINER_TTL_MS - 3_600_000) containerId = null;

    if (containerId) {
      const { code } = await containerStatus(creds.token, containerId);
      if (code === "PUBLISHED") return fail(job, "이미 게시된 컨테이너예요. 인스타그램에서 확인해 주세요.");
      if (code === "ERROR" || code === "EXPIRED") containerId = null;
    }

    if (!containerId) {
      const quota = await publishingQuota(creds.token, creds.igUserId);
      if (quota.used >= quota.total) {
        return later(job, 60 * 60_000, `하루 게시 한도(${quota.total}건)에 닿아 1시간 뒤 다시 시도해요.`);
      }
      containerId = await createContainers(job, creds);
      await update(job.id, { container_id: containerId, container_created_at: new Date().toISOString() });
    }

    const status = await waitFor(creds.token, containerId, POLL_MS);
    if (status === "IN_PROGRESS") return later(job, 60_000, null);
    if (status !== "FINISHED") {
      await update(job.id, { container_id: null, container_created_at: null });
      return later(job, 5 * 60_000, "인스타그램이 이미지를 처리하지 못했어요. 잠시 뒤 다시 시도해요.");
    }

    const mediaId = await publishContainer(creds.token, creds.igUserId, containerId);
    const permalink = await mediaPermalink(creds.token, mediaId).catch(() => null);

    let commentError: string | null = null;
    if (job.first_comment?.trim()) {
      try {
        await postComment(creds.token, mediaId, job.first_comment.trim());
      } catch (e) {
        commentError = e instanceof Error ? e.message : "첫 댓글을 달지 못했어요.";
      }
    }

    const now = new Date().toISOString();
    await update(job.id, {
      status: "published",
      media_id: mediaId,
      permalink,
      comment_error: commentError,
      published_at: now,
      lease_until: null,
      error: null,
    });
    await markEpisodePublished(job.episode_id, now);
    // Meta 가 이미 가져갔다. 발행용 사본은 남겨 둘 이유가 없다.
    await removeObjects("publish", job.image_paths.filter((p) => p.startsWith(`${job.owner_id}/`))).catch((e) =>
      console.error("[instagram] 발행 이미지 정리 실패", job.id, e),
    );
  } catch (e) {
    if (e instanceof IgApiError) {
      if (e.needsReconnect) return fail(job, "인스타그램 연결이 만료됐어요. 다시 연결한 뒤 발행해 주세요.");
      if (e.retryable) return later(job, Math.min(job.attempts, 6) * 5 * 60_000, `잠시 뒤 다시 시도해요: ${e.message}`);
      return fail(job, `인스타그램이 거절했어요: ${e.message}`);
    }
    return later(job, 5 * 60_000, e instanceof Error ? e.message : "발행 중 오류가 났어요.");
  }
}

/** 이미지 컨테이너를 만들고, 2장 이상이면 캐러셀로 묶는다. 게시할 컨테이너 id 를 돌려준다. */
async function createContainers(job: Job, creds: { token: string; igUserId: string }): Promise<string> {
  const paths = job.image_paths.slice(0, IG_CAROUSEL_MAX);
  const urls = await signedUrls("publish", job.owner_id, paths);
  const imageUrls = paths.map((p) => urls.get(p));
  if (imageUrls.some((u) => !u)) throw new Error("발행할 이미지를 찾지 못했어요. 다시 발행해 주세요.");

  if (imageUrls.length === 1) {
    return createImageContainer(creds.token, creds.igUserId, {
      imageUrl: imageUrls[0]!,
      carouselItem: false,
      caption: job.caption,
      isAiGenerated: job.is_ai_generated,
    });
  }

  const children: string[] = [];
  for (const imageUrl of imageUrls) {
    children.push(await createImageContainer(creds.token, creds.igUserId, { imageUrl: imageUrl!, carouselItem: true }));
  }
  for (const child of children) {
    const status = await waitFor(creds.token, child, POLL_MS);
    if (status !== "FINISHED") throw new Error("캐러셀 이미지 중 처리되지 않은 장이 있어요. 잠시 뒤 다시 시도해요.");
  }
  return createCarouselContainer(creds.token, creds.igUserId, {
    children,
    caption: job.caption,
    isAiGenerated: job.is_ai_generated,
  });
}

async function waitFor(token: string, containerId: string, withinMs: number) {
  const until = Date.now() + withinMs;
  for (;;) {
    const { code } = await containerStatus(token, containerId);
    if (code !== "IN_PROGRESS" || Date.now() + POLL_EVERY_MS > until) return code;
    await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
  }
}

async function markEpisodePublished(episodeId: string, at: string) {
  const db = createServiceClient();
  const { error } = await db.from("episodes").update({ status: "published", published_at: at }).eq("id", episodeId);
  if (error) console.error("[instagram] 회차 게시 상태 갱신 실패", episodeId, error);
}
