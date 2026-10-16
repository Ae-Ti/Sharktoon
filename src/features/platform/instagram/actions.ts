"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { IG_CAROUSEL_MAX, IG_IMAGE, composeInstagramCaption } from "@/contracts/instagram";
import { getRepository } from "@/features/platform/data";
import { createServiceClient } from "@/lib/supabase/service";
import { removeObjects, uploadObject } from "@/lib/supabase/storage";
import { disconnect, getAccount } from "./accounts";
import { instagramPublishEnabled } from "./config";
import { drainInstagramPublish } from "./publish";

/**
 * 인스타 발행 서버 액션. 화면 노출은 INSTAGRAM_PUBLISH_ENABLED 로 막혀 있다(출시 예정).
 * 켜져 있어도 Pro·Max 만, 그리고 Meta 앱에 역할로 등록된 계정만 연결된다(앱 심사 전).
 */

type Fail = { ok: false; message: string };
const fail = (e: unknown): Fail => ({ ok: false, message: e instanceof Error ? e.message : "처리하지 못했어요" });

export interface PublishJobView {
  id: string;
  status: "queued" | "running" | "published" | "failed" | "canceled";
  scheduledAt: string;
  publishedAt: string | null;
  permalink: string | null;
  error: string | null;
  commentError: string | null;
}

export interface InstagramPublishState {
  enabled: boolean;
  account: { username: string; tokenExpiresAt: string } | null;
  jobs: PublishJobView[];
}

/** 예약은 이 기간 안으로만. 너무 먼 예약은 토큰 만료(60일)와 겹친다. */
const MAX_SCHEDULE_DAYS = 30;

async function requireOwner(): Promise<string> {
  const repo = await getRepository();
  const userId = await repo.currentUserId();
  if (!userId) throw new Error("로그인이 필요해요");
  return userId;
}

async function assertEpisodeOwner(ownerId: string, episodeId: string) {
  const db = createServiceClient();
  const { data } = await db.from("episodes").select("owner_id").eq("id", episodeId).maybeSingle();
  if (!data || data.owner_id !== ownerId) throw new Error("회차를 찾지 못했어요.");
}

async function assertCanPublish(ownerId: string) {
  if (!instagramPublishEnabled()) throw new Error("원클릭 발행·자동 예약은 출시 예정이에요.");
  const plan = (await (await getRepository()).getProfile())?.plan ?? "free";
  if (plan !== "pro" && plan !== "max") throw new Error("원클릭 발행·자동 예약은 Pro 플랜부터 쓸 수 있어요.");
  if (!(await getAccount(ownerId))) throw new Error("먼저 인스타그램 계정을 연결해 주세요.");
}

export async function getInstagramPublishStateAction(episodeId: string): Promise<InstagramPublishState> {
  if (!instagramPublishEnabled()) return { enabled: false, account: null, jobs: [] };
  const ownerId = await requireOwner();
  const account = await getAccount(ownerId);
  const db = createServiceClient();
  const { data } = await db
    .from("instagram_publish_jobs")
    .select("id, status, scheduled_at, published_at, permalink, error, comment_error")
    .eq("owner_id", ownerId)
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(10);
  return {
    enabled: true,
    account: account ? { username: account.username, tokenExpiresAt: account.tokenExpiresAt } : null,
    jobs: (data ?? []).map((j) => ({
      id: j.id,
      status: j.status,
      scheduledAt: j.scheduled_at,
      publishedAt: j.published_at,
      permalink: j.permalink,
      error: j.error,
      commentError: j.comment_error,
    })),
  };
}

/**
 * 말풍선까지 합성한 JPEG 를 올린다(브라우저가 캔버스에서 만든다). Meta 는 공개 URL 로만 이미지를 받으므로
 * 비공개 버킷에 두었다가 발행할 때 서명 URL 을 넘긴다. 올린 경로를 순서대로 돌려준다.
 */
export async function uploadPublishImagesAction(
  form: FormData,
): Promise<{ ok: true; paths: string[] } | Fail> {
  try {
    const ownerId = await requireOwner();
    await assertCanPublish(ownerId);
    const episodeId = String(form.get("episodeId") ?? "");
    await assertEpisodeOwner(ownerId, episodeId);

    const files = form.getAll("image").filter((f): f is File => f instanceof File);
    if (files.length < 1 || files.length > IG_CAROUSEL_MAX) {
      throw new Error(`이미지는 1~${IG_CAROUSEL_MAX}장이어야 해요.`);
    }
    for (const f of files) {
      if (f.type !== IG_IMAGE.contentType) throw new Error("인스타그램은 JPEG 이미지만 받아요.");
      if (f.size > IG_IMAGE.maxBytes) throw new Error("한 장에 8MB 까지예요.");
    }

    const batch = randomUUID();
    const paths: string[] = [];
    for (const [i, f] of files.entries()) {
      const path = `${ownerId}/${batch}/${String(i + 1).padStart(2, "0")}.jpg`;
      paths.push(await uploadObject("publish", path, new Uint8Array(await f.arrayBuffer()), IG_IMAGE.contentType));
    }
    return { ok: true, paths };
  } catch (e) {
    return fail(e);
  }
}

/** 발행 등록. scheduledAt 이 없거나 지났으면 바로 발행한다. */
export async function schedulePublishAction(input: {
  episodeId: string;
  imagePaths: string[];
  /** 본문 + 해시태그를 합친 최종 캡션(composeInstagramCaption 의 text). */
  caption: string;
  firstComment?: string | null;
  scheduledAt?: string | null;
}): Promise<{ ok: true; jobId: string } | Fail> {
  try {
    const ownerId = await requireOwner();
    await assertCanPublish(ownerId);
    await assertEpisodeOwner(ownerId, input.episodeId);

    const paths = input.imagePaths ?? [];
    if (paths.length < 1 || paths.length > IG_CAROUSEL_MAX) throw new Error(`이미지는 1~${IG_CAROUSEL_MAX}장이어야 해요.`);
    if (paths.some((p) => !p.startsWith(`${ownerId}/`))) throw new Error("이미지 경로가 올바르지 않아요.");

    const check = composeInstagramCaption(input.caption ?? "", []);
    if (check.problems.length > 0) throw new Error(check.problems[0]);

    const now = Date.now();
    let scheduledAt = input.scheduledAt ? new Date(input.scheduledAt).getTime() : now;
    if (Number.isNaN(scheduledAt)) throw new Error("예약 시각을 다시 골라 주세요.");
    if (scheduledAt > now + MAX_SCHEDULE_DAYS * 86_400_000) throw new Error(`예약은 ${MAX_SCHEDULE_DAYS}일 안으로만 할 수 있어요.`);
    scheduledAt = Math.max(scheduledAt, now);

    const db = createServiceClient();
    const { data, error } = await db
      .from("instagram_publish_jobs")
      .insert({
        owner_id: ownerId,
        episode_id: input.episodeId,
        image_paths: paths,
        caption: check.text,
        first_comment: input.firstComment?.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        is_ai_generated: true,
      })
      .select("id")
      .single();
    if (error) throw error;

    // 바로 발행이면 응답을 보낸 뒤 작업자를 한 번 돌린다. 나머지는 1분마다 크론이 깨운다.
    if (scheduledAt - now < 60_000) {
      after(async () => {
        try {
          await drainInstagramPublish(120_000);
        } catch (e) {
          console.error("[instagram] 즉시 발행 작업자 오류", e);
        }
      });
    }
    revalidatePath(`/episodes/${input.episodeId}/publish`);
    return { ok: true, jobId: data.id };
  } catch (e) {
    return fail(e);
  }
}

/** 아직 꺼내지 않은 예약을 취소한다. 올려 둔 이미지도 지운다. */
export async function cancelPublishAction(jobId: string): Promise<{ ok: true } | Fail> {
  try {
    const ownerId = await requireOwner();
    const db = createServiceClient();
    const { data, error } = await db
      .from("instagram_publish_jobs")
      .update({ status: "canceled", lease_until: null })
      .eq("id", jobId)
      .eq("owner_id", ownerId)
      .eq("status", "queued")
      .select("image_paths, episode_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("이미 발행 중이거나 끝난 작업이에요.");
    await removeObjects("publish", data.image_paths.filter((p) => p.startsWith(`${ownerId}/`)));
    revalidatePath(`/episodes/${data.episode_id}/publish`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 인스타 연결 해제. 토큰과 대기 중인 발행·이미지를 지운다(Meta 플랫폼 약관 §3.d). */
export async function disconnectInstagramAccountAction(): Promise<{ ok: true } | Fail> {
  try {
    const ownerId = await requireOwner();
    await disconnect(ownerId);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
