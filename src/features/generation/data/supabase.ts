import "server-only";

import type { GenerationJob } from "@/contracts/generation";
import { resolveImages, storeImage } from "@/features/platform/data/images";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { CutLayerTree } from "../types/layer";
import type { Storyboard } from "../types/storyboard";
import type { CutRecord, GenerationStore, PostPackage } from "./types";

/**
 * Supabase 생성 저장소.
 * 사용자 요청 메서드는 세션 클라이언트(RLS), worker* 는 서비스 롤 클라이언트를 쓴다.
 */

async function userId(): Promise<string> {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) throw new Error("로그인이 필요해요");
  return data.user.id;
}

/** 저장된 잡의 컷 ref 를 보기용 URL 로 바꾼다. 서명 URL 은 저장하지 않는다(만료된다). */
async function withImageUrls(ownerId: string, job: GenerationJob): Promise<GenerationJob> {
  const refs = job.cuts.map((c) => c.imageRef).filter((r): r is string => Boolean(r));
  const urls = await resolveImages("cuts", ownerId, refs);
  return {
    ...job,
    cuts: job.cuts.map((c) => ({
      ...c,
      imageUrl: c.imageRef ? urls.get(c.imageRef) : undefined,
    })),
  };
}

type JobRow = {
  id: string;
  owner_id: string;
  episode_id: string;
  mode: string;
  status: GenerationJob["status"];
  cuts: Json;
  created_at: string;
  finished_at: string | null;
};

function fromJobRow(row: JobRow, seriesId: string): GenerationJob {
  return {
    id: row.id,
    userId: row.owner_id,
    episodeId: row.episode_id,
    seriesId,
    mode: row.mode as GenerationJob["mode"],
    status: row.status,
    cuts: row.cuts as unknown as GenerationJob["cuts"],
    createdAt: row.created_at,
    finishedAt: row.finished_at ?? undefined,
  };
}

const JOB_COLUMNS = "id, owner_id, episode_id, mode, status, cuts, created_at, finished_at, episodes(series_id)";

export const supabaseGenerationStore: GenerationStore = {
  async getStoryboard(episodeId) {
    const db = await createClient();
    const { data } = await db
      .from("storyboards")
      .select("data, used_mock")
      .eq("episode_id", episodeId)
      .maybeSingle();
    if (!data) return null;
    return { storyboard: data.data as unknown as Storyboard, usedMock: data.used_mock };
  },

  async saveStoryboard(storyboard, usedMock) {
    const db = await createClient();
    const { error } = await db.from("storyboards").upsert({
      episode_id: storyboard.episodeId,
      owner_id: await userId(),
      data: storyboard as unknown as Json,
      used_mock: usedMock,
    });
    if (error) throw error;
  },

  async getJob(jobId) {
    const db = await createClient();
    const { data } = await db.from("generation_jobs").select(JOB_COLUMNS).eq("id", jobId).maybeSingle();
    if (!data) return null;
    const seriesId = (data.episodes as unknown as { series_id: string } | null)?.series_id ?? "";
    return withImageUrls(data.owner_id, fromJobRow(data, seriesId));
  },

  async getLatestJob(episodeId) {
    const db = await createClient();
    const { data } = await db
      .from("generation_jobs")
      .select(JOB_COLUMNS)
      .eq("episode_id", episodeId)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (!row) return null;
    const seriesId = (row.episodes as unknown as { series_id: string } | null)?.series_id ?? "";
    return withImageUrls(row.owner_id, fromJobRow(row, seriesId));
  },

  async listCuts(episodeId) {
    const db = await createClient();
    const { data } = await db
      .from("cuts")
      .select("cut_id, index, image_path, layer_tree, owner_id")
      .eq("episode_id", episodeId)
      .order("index");
    const rows = data ?? [];
    if (rows.length === 0) return [];
    const urls = await resolveImages(
      "cuts",
      rows[0].owner_id,
      rows.map((r) => r.image_path).filter((p): p is string => Boolean(p)),
    );
    return rows.map(
      (r): CutRecord => ({
        cutId: r.cut_id,
        index: r.index,
        imageRef: r.image_path,
        imageUrl: r.image_path ? (urls.get(r.image_path) ?? null) : null,
        layerTree: (r.layer_tree as unknown as CutLayerTree | null) ?? null,
      }),
    );
  },

  async saveLayerTree(episodeId, cutId, tree) {
    const db = await createClient();
    const { data, error } = await db
      .from("cuts")
      .update({ layer_tree: tree as unknown as Json })
      .eq("episode_id", episodeId)
      .eq("cut_id", cutId)
      .select("cut_id");
    if (error) throw error;
    if (!data?.length) throw new Error("저장할 컷을 찾지 못했어요");
  },

  async getPostPackage(episodeId) {
    const db = await createClient();
    const { data } = await db
      .from("post_packages")
      .select("captions, hashtags, first_comment, used_mock, updated_at")
      .eq("episode_id", episodeId)
      .maybeSingle();
    if (!data) return null;
    return {
      captions: data.captions as unknown as PostPackage["captions"],
      hashtags: data.hashtags as unknown as PostPackage["hashtags"],
      firstComment: data.first_comment,
      usedMock: data.used_mock,
      updatedAt: data.updated_at,
    };
  },

  async savePostPackage(episodeId, pkg) {
    const db = await createClient();
    const { error } = await db.from("post_packages").upsert({
      episode_id: episodeId,
      owner_id: await userId(),
      captions: pkg.captions as unknown as Json,
      hashtags: pkg.hashtags as unknown as Json,
      first_comment: pkg.firstComment,
      used_mock: pkg.usedMock,
    });
    if (error) throw error;
  },

  async markPublished(episodeId) {
    const db = await createClient();
    const { data, error } = await db
      .from("episodes")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", episodeId)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("회차를 찾지 못했어요");
  },

  async workerSaveJob(job) {
    const db = createServiceClient();
    // 보기용 URL 은 만료되므로 저장하지 않는다. ref 만 남긴다.
    const cuts = job.cuts.map((c) => ({ ...c, imageUrl: undefined }));
    const { error } = await db.from("generation_jobs").upsert({
      id: job.id,
      owner_id: job.userId,
      episode_id: job.episodeId,
      mode: job.mode,
      status: job.status,
      cuts: cuts as unknown as Json,
      created_at: job.createdAt,
      finished_at: job.finishedAt ?? null,
    });
    if (error) throw error;
  },

  async workerSaveCutImage({ ownerId, episodeId, cutId, index, imageUrl, meta }) {
    const imageRef = await storeImage({
      bucket: "cuts",
      ownerId,
      path: `${episodeId}/${cutId}`,
      imageUrl,
    });
    const db = createServiceClient();
    const { error } = await db.from("cuts").upsert({
      episode_id: episodeId,
      cut_id: cutId,
      owner_id: ownerId,
      index,
      image_path: imageRef,
      generation_meta: meta as Json,
    });
    if (error) throw error;
    const urls = await resolveImages("cuts", ownerId, [imageRef]);
    return { imageRef, imageUrl: urls.get(imageRef) ?? "" };
  },

  async workerSetEpisodeStatus(episodeId, status) {
    const db = createServiceClient();
    const { error } = await db.from("episodes").update({ status }).eq("id", episodeId);
    if (error) throw error;
  },
};
