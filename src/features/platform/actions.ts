"use server";

import { revalidatePath } from "next/cache";
import { CHARACTER_SHEET_VIEWS } from "@/contracts/generation";
import { getImageGenerator } from "@/features/generation/image";
import { dataSource } from "@/lib/supabase/env";
import { removeObjects } from "@/lib/supabase/storage";
import { getRepository } from "./data";
import { checkUpload, resolveImages, storeImage, storeUpload } from "./data/images";
import type { AssetInput, SeriesInput, SeriesRule, PlanTier } from "./data/types";
import { extractCharacterFeaturesFromSelfie, extractStoryFromImage } from "./vision";
import { generateAssetIllustrationSvg } from "./assets/assetVisuals";
import { resolveStyleAnchor } from "@/features/generation/image/promptBuilder";

/** 출석 체크. 하루 1크레딧, 7일 연속이면 총 3크레딧(보너스 2크레딧)을 준다. */
export async function checkInAction(): Promise<
  { ok: true; granted: number; streak: number } | { ok: false; message: string }
> {
  try {
    const repo = await getRepository();
    const { granted, streak } = await repo.checkIn();
    revalidatePath("/home");
    revalidatePath("/settings");
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

/**
 * 소재의 레퍼런스/썸네일 비주얼 생성 (OpenAI 생성기 또는 화풍 맞춤 일러스트)
 */
export async function generateAssetVisualAction(input: {
  name: string;
  kind: "character" | "location" | "prop" | "animal";
  description?: string | null;
  tags?: string[];
  stylePreset?: string;
  customStyleImageUrl?: string | null;
  referenceImageUrl?: string | null;
}): Promise<{ ok: true; imageUrl: string } | Fail> {
  try {
    const style = input.stylePreset || "심플 라인";
    const tagList = input.tags ?? [];
    const desc = input.description || "";

    // 1. OpenAI 또는 이미지 생성기 가용 시 실제 AI 생성 시도
    if (process.env.OPENAI_API_KEY) {
      try {
        const generator = getImageGenerator();
        const styleAnchor = resolveStyleAnchor(style);
        const prompt = [
          `[USE CASE & MEDIUM]: Korean 2D webtoon asset illustration on clean background.`,
          `[ASSET TYPE]: ${input.kind} (${input.name})`,
          `[SPECIFICATION]: ${desc}. Features & Tags: ${tagList.join(", ")}`,
          `[ART DIRECTION & STYLE]: Clean 2D Korean webtoon manhwa style, uniform crisp lineart, solid flat cel shading, zero gradients, zero 3D rendering. Style preset: ${styleAnchor}.`,
        ].join("\n");

        const refs = input.referenceImageUrl
          ? [input.referenceImageUrl]
          : input.customStyleImageUrl
          ? [input.customStyleImageUrl]
          : [];

        const result = await generator.generateCut({
          cutId: `as_${crypto.randomUUID().slice(0, 8)}`,
          index: 1,
          episodeId: "asset_gen",
          seriesId: "asset_gen",
          intent: "regenerate",
          prompt,
          characterSheetRefs: refs,
          assetRefs: refs,
          seriesRule: {
            stylePreset: style,
            defaultCutCount: 6,
            aspectRatio: "1:1",
            tone: null,
            fixedHashtags: [],
            customStyleImageUrl: input.customStyleImageUrl,
          },
        });

        if (result.imageUrl) {
          return { ok: true, imageUrl: result.imageUrl };
        }
      } catch (genErr) {
        console.warn("AI asset visual generation fallback to SVG:", genErr);
      }
    }

    // 2. Fallback to style-aligned illustration SVG
    const svg = generateAssetIllustrationSvg({
      name: input.name,
      kind: input.kind,
      description: input.description,
      tags: input.tags,
      style,
      customStyleImageUrl: input.customStyleImageUrl,
    });

    return { ok: true, imageUrl: svg };
  } catch (e) {
    return fail(e);
  }
}

export async function saveAssetAction(
  id: string | null,
  input: AssetInput,
  seriesIds?: string[],
): Promise<ResultWithId> {
  try {
    const repo = await getRepository();
    const saved = id ? await repo.updateAsset(id, input) : await repo.createAsset(input);

    if (seriesIds !== undefined) {
      const allSeries = await repo.listSeries();
      await Promise.all(
        allSeries.map(async (s) => {
          const detail = await repo.getSeries(s.id);
          if (!detail) return;
          const currentIds = detail.assets.map((a) => a.id);
          const shouldHave = seriesIds.includes(s.id);
          const has = currentIds.includes(saved.id);

          if (shouldHave && !has) {
            await repo.setSeriesAssets(s.id, [...currentIds, saved.id]);
          } else if (!shouldHave && has) {
            await repo.setSeriesAssets(
              s.id,
              currentIds.filter((cid) => cid !== saved.id),
            );
          }
        }),
      );
    }

    revalidatePath("/assets");
    revalidatePath("/series");
    return { ok: true, id: saved.id };
  } catch (e) {
    return fail(e);
  }
}

/** 에셋을 특정 시리즈에 추가하거나 제외한다. */
export async function toggleSeriesAssetAction(
  seriesId: string,
  assetId: string,
  attach: boolean,
): Promise<Result> {
  try {
    const repo = await getRepository();
    const series = await repo.getSeries(seriesId);
    if (!series) throw new Error("없는 시리즈예요");
    const currentIds = series.assets.map((a) => a.id);
    let newIds: string[];
    if (attach) {
      if (currentIds.includes(assetId)) return { ok: true };
      newIds = [...currentIds, assetId];
    } else {
      newIds = currentIds.filter((id) => id !== assetId);
    }
    await repo.setSeriesAssets(seriesId, newIds);
    revalidatePath("/assets");
    revalidatePath(`/series/${seriesId}`);
    return { ok: true };
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
    let effectiveTags = tags;
    let effectiveDesc = tags.length ? tags.join(", ") : null;

    if (method === "selfie") {
      const uploadFile = checkUpload(form.get("selfie"));
      selfieRef = await storeUpload({
        bucket: "assets",
        ownerId,
        path: `${asset.id}/selfie`,
        file: uploadFile,
      });
      selfieUrl = (await resolveImages("assets", ownerId, [selfieRef])).get(selfieRef);

      // Gemini Vision으로 셀카 분석하여 2D 캐릭터 외모 특징 추출
      const bytes = await uploadFile.arrayBuffer();
      const visionFeatures = await extractCharacterFeaturesFromSelfie({
        buffer: bytes,
        mimeType: uploadFile.type || "image/jpeg",
      });

      if (visionFeatures) {
        effectiveTags = visionFeatures.tags;
        effectiveDesc = visionFeatures.description;
        await repo.updateAsset(asset.id, {
          kind: asset.kind,
          name: asset.name,
          tags: effectiveTags,
          description: effectiveDesc,
        });
      }
    }

    const sheet = await getImageGenerator().generateCharacterSheet({
      name: asset.name,
      selfieUrl,
      tags: effectiveTags,
      description: effectiveDesc ?? undefined,
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
    if (input.cutCount < 1 || input.cutCount > 20) throw new Error("컷 수는 1컷에서 최대 20컷 사이로 선택해 주세요.");
    const r = await repo.startEpisode({ ...input, story });
    revalidatePath("/home");
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

/**
 * 선택된 시리즈에서 사연 입력 없이 초안 회차를 바로 생성 (스토리보드 화면으로 이동)
 */
export async function startEpisodeDraftAction(input: {
  seriesId: string;
  cutCount?: number;
}): Promise<{ ok: true; episodeId: string; seriesId: string } | Fail> {
  try {
    const repo = await getRepository();
    const r = await repo.startEpisode({
      story: "",
      cutCount: input.cutCount ?? 4,
      seriesId: input.seriesId,
    });
    revalidatePath("/home");
    revalidatePath(`/series/${input.seriesId}`);
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

/** 회차의 소속 시리즈 변경 */
export async function updateEpisodeSeriesAction(
  episodeId: string,
  seriesId: string
): Promise<Result> {
  try {
    const repo = await getRepository();
    await repo.updateEpisode(episodeId, { seriesId });
    revalidatePath(`/episodes/${episodeId}/storyboard`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}


/** 환불 신청(약관 제14조). 견적은 서버가 그 시점 값으로 계산한다. */
export async function requestRefundAction(reason: string | null): Promise<Result> {
  try {
    await (await getRepository()).requestRefund(reason?.slice(0, 500) || null);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 탈퇴 요청. 30일 안에는 철회할 수 있다. */
export async function requestAccountDeletionAction(): Promise<Result> {
  try {
    await (await getRepository()).requestAccountDeletion();
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelAccountDeletionAction(): Promise<Result> {
  try {
    await (await getRepository()).cancelAccountDeletion();
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 운영자: 환불 승인·거절. 권한은 DB 함수가 다시 확인한다(SK004). */
export async function processRefundAction(
  id: string,
  approve: boolean,
  note: string | null,
): Promise<Result> {
  try {
    await (await getRepository()).processRefund(id, approve, note);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 운영자: 수동 지급(베타 테스터, 계좌이체). */
export async function grantPurchaseAction(input: {
  userId: string;
  credits: number;
  amountKrw: number;
  note: string | null;
}): Promise<Result> {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(input.userId)) throw new Error("사용자 id 형식이 아니에요.");
    if (!(input.credits > 0 && input.credits <= 10_000)) throw new Error("크레딧은 1~10000 사이로 적어 주세요.");
    if (!(input.amountKrw >= 0 && input.amountKrw <= 10_000_000)) throw new Error("금액을 확인해 주세요.");
    await (await getRepository()).grantPurchase(input);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 이미지(카톡 캡처, SNS 글 등)에서 인스타툰 사연 내용 추출 */
export async function extractStoryFromImageAction(
  formData: FormData,
): Promise<{ ok: true; story: string } | { ok: false; message: string }> {
  try {
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return { ok: false, message: "이미지 파일이 전송되지 않았습니다." };
    }
    const validFile = checkUpload(file);
    const bytes = await validFile.arrayBuffer();
    const story = await extractStoryFromImage({
      buffer: bytes,
      mimeType: file.type || "image/jpeg",
    });
    if (!story) {
      return {
        ok: false,
        message: "이미지에서 대화나 사연 내용을 인식하지 못했습니다. 텍스트를 직접 입력해 주세요.",
      };
    }
    return { ok: true, story };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "이미지 분석 중 오류가 발생했습니다.",
    };
  }
}

/** 플랜 변경 / 구독 시작 */
export async function updatePlanAction(
  plan: PlanTier,
): Promise<{ ok: true; plan: PlanTier } | { ok: false; message: string }> {
  try {
    const repo = await getRepository();
    if ("updatePlan" in repo && typeof (repo as any).updatePlan === "function") {
      await (repo as any).updatePlan(plan);
    }
    revalidatePath("/settings");
    revalidatePath("/home");
    return { ok: true, plan };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "플랜 변경에 실패했습니다.",
    };
  }
}

/** 크레딧 단품 팩 구매 충전 */
export async function purchaseCreditPackAction(
  packId: string
): Promise<{ ok: true; credits: number; newBalance: number } | { ok: false; message: string }> {
  try {
    const repo = await getRepository();
    const { CREDIT_PACKS } = await import("./pricing/creditPacks");
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return { ok: false, message: "존재하지 않는 크레딧 팩입니다." };
    }

    if ("purchaseCredits" in repo && typeof (repo as any).purchaseCredits === "function") {
      const res = await (repo as any).purchaseCredits(pack.credits, pack.priceKrw);
      revalidatePath("/settings");
      revalidatePath("/home");
      return { ok: true, credits: pack.credits, newBalance: res.balance };
    }

    revalidatePath("/settings");
    revalidatePath("/home");
    return { ok: true, credits: pack.credits, newBalance: pack.credits };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "크레딧 충전에 실패했습니다.",
    };
  }
}


