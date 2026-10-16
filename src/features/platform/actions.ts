"use server";

import { revalidatePath } from "next/cache";
import { CREDIT_COST, InsufficientCreditError } from "@/contracts/credit";
import { CHARACTER_SHEET_VIEWS, isSafetyBlocked } from "@/contracts/generation";
import { recordSafetyEvent, safetyLockMessage } from "@/features/generation/safety/strikes";
import { EPISODE_CUTS_MAX, EPISODE_CUTS_MIN } from "@/contracts/instagram";
import { getImageGenerator } from "@/features/generation/image";
import { getRepository } from "./data";
import { checkUpload, storeImage } from "./data/images";
import type { AssetInput, SeriesInput, SeriesRule, PlanTier } from "./data/types";
import { extractStoryFromImage } from "./vision";
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

/** 사진 업로드로 만드는 커스텀 화풍은 Pro 부터다. 이미 쓰고 있던 이미지는 그대로 둔다(다운그레이드 후 수정). */
async function assertCustomStyleAllowed(
  repo: Awaited<ReturnType<typeof getRepository>>,
  rule: SeriesRule,
  prev?: SeriesRule | null,
) {
  if (!rule.customStyleImageUrl || rule.customStyleImageUrl === prev?.customStyleImageUrl) return;
  const plan = (await repo.getProfile())?.plan ?? "free";
  if (plan !== "pro" && plan !== "max") {
    throw new Error("사진 업로드로 만드는 나만의 화풍은 Pro 플랜부터 쓸 수 있어요.");
  }
}

/** 화면이 요금제별 기능을 미리 잠글 때 쓴다. 실제 차단은 각 액션이 서버에서 한다. */
export async function getMyPlanAction(): Promise<PlanTier> {
  const repo = await getRepository();
  return (await repo.getProfile())?.plan ?? "free";
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
    if (!input.name?.trim()) throw new Error("소재 이름을 먼저 적어 주세요.");
    if (!input.description?.trim()) throw new Error("설명을 먼저 적어 주세요.");

    // 1. OpenAI 또는 이미지 생성기 가용 시 실제 AI 생성 시도. 컷과 같이 1크레딧, 실패하면 환불한다.
    if (process.env.OPENAI_API_KEY) {
      const repo = await getRepository();
      const userId = await repo.currentUserId();
      if (!userId) throw new Error("로그인이 필요해요");
      const lock = await safetyLockMessage(userId);
      if (lock) throw new Error(lock);
      let holdId: string;
      try {
        holdId = await repo.holdCredit({
          userId,
          amount: CREDIT_COST.cutImage,
          reason: "cut_image",
          jobId: `asset_${crypto.randomUUID()}`,
        });
      } catch (e) {
        if (e instanceof InsufficientCreditError) {
          throw new Error(`크레딧이 부족해요. 소재 이미지 생성에 ${CREDIT_COST.cutImage}크레딧이 필요해요.`);
        }
        throw e;
      }
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

        if (!result.imageUrl) throw new Error("이미지가 비어 있어요");
        await repo.commitCredit(holdId);
        revalidatePath("/settings");
        return { ok: true, imageUrl: result.imageUrl };
      } catch (genErr) {
        await repo.refundCredit(holdId, genErr instanceof Error ? genErr.message : "소재 이미지 생성 실패");
        // 안전 검사에 걸린 건 기본 일러스트로 덮지 않고 알린다(크레딧은 돌려준다).
        if (isSafetyBlocked(genErr)) {
          await recordSafetyEvent({ ownerId: userId, kind: "image_flagged", source: genErr.provider });
          throw new Error(`${genErr.message.replace("이 컷을", "이 소재 이미지를").replace("장면을", "설명을")} 크레딧은 돌려드렸어요.`);
        }
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
    if (!input.name?.trim()) throw new Error("소재 이름을 적어 주세요.");
    // 설명은 소재 이미지와 모든 컷 생성 지시문에 그대로 들어간다. 비면 일관성이 무너진다.
    if (!input.description?.trim()) throw new Error("설명을 적어 주세요.");
    const repo = await getRepository();
    // AI 로 만든(또는 사진을 화풍 변환한) 이미지는 생성기 URL 이 만료될 수 있어 우리 버킷에 옮겨 둔다.
    // 이 이미지가 소재 레퍼런스가 되어 모든 컷 생성에 실린다. 기본 일러스트(SVG)는 그대로 둔다.
    let thumbUrl = input.thumbUrl;
    if (thumbUrl && /^(https?:|data:image\/(png|jpeg|webp))/.test(thumbUrl)) {
      const ownerId = await repo.currentUserId();
      if (!ownerId) throw new Error("로그인이 필요해요");
      thumbUrl = await storeImage({ bucket: "assets", ownerId, path: `visuals/${crypto.randomUUID()}`, imageUrl: thumbUrl });
    }
    const assetInput = { ...input, thumbUrl };
    const saved = id ? await repo.updateAsset(id, assetInput) : await repo.createAsset(assetInput);

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
 * 온보딩 1단계 — 특징 태그로 캐릭터 시트를 만든다(PRD 1.1).
 * 시트는 정면·측면·표정 4종·전신 7장이고, 모든 생성 호출에 고정 레퍼런스로 실린다.
 * 셀카로 만들기는 2026-10-16 에 뺐다.
 */
export async function createCharacterAction(
  form: FormData,
): Promise<{ ok: true; assetId: string } | Fail> {
  try {
    const repo = await getRepository();
    const ownerId = await repo.currentUserId();
    if (!ownerId) throw new Error("로그인이 필요해요");

    const style = String(form.get("style") ?? "심플 라인").slice(0, 20);
    const tags = String(form.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > 5) throw new Error("특징 태그는 5개까지예요.");
    if (tags.length === 0) throw new Error("특징을 하나 이상 적어 주세요.");

    const description = tags.join(", ");
    const asset = await repo.createAsset({
      kind: "character",
      name: "나",
      description,
      tags,
    });

    const lock = await safetyLockMessage(ownerId);
    if (lock) throw new Error(lock);
    let sheet;
    try {
      sheet = await getImageGenerator().generateCharacterSheet({ name: asset.name, tags, description, style });
    } catch (e) {
      if (isSafetyBlocked(e)) await recordSafetyEvent({ ownerId, kind: "image_flagged", source: e.provider });
      throw e;
    }
    const refs: string[] = [];
    for (const view of CHARACTER_SHEET_VIEWS) {
      const imageUrl = sheet.views.find((v) => v.view === view)?.imageUrl;
      if (!imageUrl) continue;
      refs.push(await storeImage({ bucket: "assets", ownerId, path: `${asset.id}/sheet_${view}`, imageUrl }));
    }
    await repo.setAssetReferences(asset.id, refs);

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
    await assertCustomStyleAllowed(repo, input.rule);
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
    const prev = (await repo.getSeries(seriesId))?.rule ?? null;
    await assertCustomStyleAllowed(repo, rule, prev);
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
    if (input.cutCount < EPISODE_CUTS_MIN || input.cutCount > EPISODE_CUTS_MAX) {
      throw new Error(`컷 수는 ${EPISODE_CUTS_MIN}~${EPISODE_CUTS_MAX}컷 사이로 골라 주세요.`);
    }
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


