"use server";

import { revalidatePath } from "next/cache";
import { CHARACTER_SHEET_VIEWS } from "@/contracts/generation";
import { getImageGenerator } from "@/features/generation/image";
import { dataSource } from "@/lib/supabase/env";
import { removeObjects } from "@/lib/supabase/storage";
import { getRepository } from "./data";
import { checkUpload, resolveImages, storeImage, storeUpload } from "./data/images";
import type { AssetInput, SeriesInput, SeriesRule } from "./data/types";

/** 출석 체크. 하루 1크레딧, 7일 연속이면 3크레딧을 더 준다. */
export async function checkInAction(): Promise<
  { ok: true; granted: number; streak: number } | { ok: false; message: string }
> {
  try {
    const repo = await getRepository();
    const { granted, streak } = await repo.checkIn();
    revalidatePath("/home");
    return { ok: true, granted, streak };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "출석에 실패했어요",
    };
  }
}

type Fail = { ok: false; message: string };
type Result = { ok: true } | Fail;
type ResultWithId = { ok: true; id: string } | Fail;

function fail(e: unknown): Fail {
  return {
    ok: false,
    message: e instanceof Error ? e.message : "처리하지 못했어요",
  };
}

export async function saveAssetAction(
  id: string | null,
  input: AssetInput,
): Promise<ResultWithId> {
  try {
    const repo = await getRepository();
    const saved = id ? await repo.updateAsset(id, input) : await repo.createAsset(input);
    revalidatePath("/assets");
    return { ok: true, id: saved.id };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 에셋 레퍼런스 이미지 올리기(PRD 2.1 "각 에셋은 레퍼런스 이미지를 보유한다").
 * 파일은 서버가 받아 비공개 버킷에 넣는다. 에셋 소유는 RLS 가 확인한다.
 */
export async function uploadAssetReferenceAction(form: FormData): Promise<Result> {
  try {
    const repo = await getRepository();
    const ownerId = await repo.currentUserId();
    if (!ownerId) throw new Error("로그인이 필요해요");
    const assetId = String(form.get("assetId") ?? "");
    // 남의 에셋이면 목록에 없다(RLS). 경로에 쓰기 전에 먼저 확인한다.
    if (!(await repo.listAssets()).some((a) => a.id === assetId)) {
      throw new Error("없는 에셋이에요");
    }
    const file = checkUpload(form.get("file"));
    const ref = await storeUpload({
      bucket: "assets",
      ownerId,
      path: `${assetId}/ref_${crypto.randomUUID().slice(0, 8)}`,
      file,
    });
    await repo.addAssetReference(assetId, ref);
    revalidatePath("/assets");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 온보딩 1단계 — 셀카·특징 태그·설명으로 캐릭터 시트를 만든다(PRD 1.1).
 * 시트는 정면·측면·표정 4종·전신 7장이고, 모든 생성 호출에 고정 레퍼런스로 실린다.
 * 셀카 원본은 시트를 만든 뒤 지운다. 사용자가 보관을 켠 경우에만 남긴다.
 */
export async function createCharacterAction(
  form: FormData,
): Promise<{ ok: true; assetId: string } | Fail> {
  try {
    const repo = await getRepository();
    const ownerId = await repo.currentUserId();
    if (!ownerId) throw new Error("로그인이 필요해요");

    const method = String(form.get("method") ?? "");
    const style = String(form.get("style") ?? "심플 라인").slice(0, 20);
    const tags = String(form.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > 5) throw new Error("특징 태그는 5개까지예요.");
    if (method === "tags" && tags.length === 0) throw new Error("특징을 하나 이상 적어 주세요.");
    if (method !== "tags" && method !== "selfie") throw new Error("캐릭터 만드는 방법을 골라 주세요.");

    const asset = await repo.createAsset({
      kind: "character",
      name: "나",
      description: tags.length ? tags.join(", ") : null,
      tags,
    });

    let selfieRef: string | null = null;
    let selfieUrl: string | undefined;
    if (method === "selfie") {
      selfieRef = await storeUpload({
        bucket: "assets",
        ownerId,
        path: `${asset.id}/selfie`,
        file: checkUpload(form.get("selfie")),
      });
      selfieUrl = (await resolveImages("assets", ownerId, [selfieRef])).get(selfieRef);
    }

    const sheet = await getImageGenerator().generateCharacterSheet({
      name: asset.name,
      selfieUrl,
      tags,
      style,
    });
    const refs: string[] = [];
    for (const view of CHARACTER_SHEET_VIEWS) {
      const imageUrl = sheet.views.find((v) => v.view === view)?.imageUrl;
      if (!imageUrl) continue;
      refs.push(await storeImage({ bucket: "assets", ownerId, path: `${asset.id}/sheet_${view}`, imageUrl }));
    }

    const profile = await repo.getProfile();
    if (selfieRef && profile?.keepSelfieOriginal) refs.push(selfieRef);
    await repo.setAssetReferences(asset.id, refs);

    // 셀카 원본 기본 삭제(개인정보 처리방침). 목에는 파일이 없으니 지울 것도 없다.
    if (selfieRef && !profile?.keepSelfieOriginal && dataSource() !== "mock") {
      await removeObjects("assets", [selfieRef]);
    }

    revalidatePath("/assets");
    return { ok: true, assetId: asset.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAssetAction(id: string): Promise<Result> {
  try {
    const repo = await getRepository();
    await repo.deleteAsset(id);
    revalidatePath("/assets");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createSeriesAction(
  input: SeriesInput,
): Promise<ResultWithId> {
  try {
    const repo = await getRepository();
    const s = await repo.createSeries(input);
    revalidatePath("/home");
    return { ok: true, id: s.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSeriesRuleAction(
  seriesId: string,
  rule: SeriesRule,
): Promise<Result> {
  try {
    const repo = await getRepository();
    await repo.updateSeriesRule(seriesId, rule);
    revalidatePath(`/series/${seriesId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 다음 화를 연다. 번호는 서버가 정한다. */
export async function createEpisodeAction(
  seriesId: string,
  story: string,
): Promise<ResultWithId> {
  try {
    const repo = await getRepository();
    const ep = await repo.createEpisode(seriesId, story);
    revalidatePath(`/series/${seriesId}`);
    return { ok: true, id: ep.id };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 온보딩에서 받은 사연으로 시리즈와 1화를 연다.
 * 여기서 만들어진 episodeId 로 콘티·생성 화면이 컨텍스트를 읽는다.
 */
export async function startEpisodeAction(input: {
  story: string;
  cutCount: number;
  seriesId?: string;
  stylePreset?: string;
  characterAssetId?: string;
}): Promise<{ ok: true; episodeId: string; seriesId: string } | Fail> {
  try {
    const repo = await getRepository();
    const story = input.story.trim().slice(0, 500);
    if (!story) throw new Error("사연을 적어 주세요.");
    if (![4, 6, 8].includes(input.cutCount)) throw new Error("컷 수는 4, 6, 8 중에서 골라 주세요.");
    const r = await repo.startEpisode({ ...input, story });
    revalidatePath("/home");
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}
