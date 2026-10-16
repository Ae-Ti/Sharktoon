"use server";

/**
 * 생성 영역 서버 액션 — 콘티, 생성, 편집, 게시물 패키지.
 *
 * 서버 액션은 화면 밖에서 POST 로 바로 부를 수 있다. 그래서 모든 액션이 먼저
 * `ownedEpisode()` 로 회차 소유를 확인한다(회차 컨텍스트 읽기가 RLS 를 탄다 —
 * 남의 회차면 null 이다). 화면이 보낸 콘티·레이어는 모양과 크기를 다시 본다.
 */

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { InsufficientCreditError } from "@/contracts/credit";
import type { CutEditIntent, GenerationJob, GenerationTier } from "@/contracts/generation";
import { getRepository } from "@/features/platform/data";
import { loadEpisodeContext, type EpisodeContext } from "@/features/platform/episode";
import { getGenerationStore, type PostPackage } from "./data";
import { generateFirstComment, generatePostPackage } from "./post/generate";
import { drainQueue, regenerateCut, retryFailedCuts, startGeneration } from "./pipeline";
import { generateStoryboard, isAnthropicConfigured } from "./storyboard/generate";
import { extractEntitiesFromStory } from "./storyboard/extractEntities";
import type { CutLayerTree } from "./types/layer";
import type { Storyboard } from "./types/storyboard";

/** 화면이 받는 결과. 실패 사유를 문구 하나로 뭉개지 않는다 — 처리가 다르다. */
export type ActionResult<T> =
  | { ok: true; data: T }
  /** 콘텐츠 필터. 사용자가 입력을 고쳐야 한다. */
  | { ok: false; kind: "safety"; message: string }
  /** 크레딧 부족. 충전 시트를 연다. */
  | { ok: false; kind: "credit"; message: string; required: number; available: number }
  | { ok: false; kind: "error"; message: string };

class ActionError extends Error {}

/**
 * 큐에 넣은 뒤 응답을 보내고 나서 작업자를 돌린다. 서버리스는 응답 뒤에도 `after` 가 끝날
 * 때까지(페이지의 maxDuration 안에서) 함수를 살려 둔다. 못 끝낸 일은 다음 작업자가 이어 한다.
 */
function kickQueue() {
  after(async () => {
    try {
      await drainQueue();
    } catch (e) {
      console.error("[generation] 큐 처리 실패", e);
    }
  });
}

async function ownedEpisode(episodeId: string): Promise<{ context: EpisodeContext; userId: string }> {
  const repo = await getRepository();
  const [context, userId] = await Promise.all([
    loadEpisodeContext(episodeId),
    repo.currentUserId(),
  ]);
  if (!context || !userId) throw new ActionError("이 회차를 찾지 못했어요");
  return { context, userId };
}

/** PRD 2.2 — 사연에서 콘티를 만들고 저장한다. 크레딧을 쓰지 않는다. */
export async function generateStoryboardAction(input: {
  episodeId: string;
  /** 고쳐 쓴 사연. 없으면 회차에 저장된 사연을 쓴다. */
  story?: string;
  /** 변경할 컷 수 (선택). */
  cutCount?: number;
  /** 변경할 소속 시리즈 ID (선택). */
  seriesId?: string;
}): Promise<ActionResult<{ storyboard: Storyboard; usedMock: boolean }>> {
  try {
    const { context } = await ownedEpisode(input.episodeId);
    const story = (input.story ?? context.story).trim();
    if (story.length < 10) {
      return { ok: false, kind: "error", message: "사연을 조금 더 적어주세요. 한 문장이면 충분해요." };
    }

    const repo = await getRepository();

    // 0. 사연이나 컷 수, 시리즈 변경사항이 있으면 DB에 반영
    if (
      (input.story && input.story !== context.story) ||
      (input.cutCount && input.cutCount !== context.cutCount) ||
      (input.seriesId && input.seriesId !== context.seriesId)
    ) {
      await repo.updateEpisode(input.episodeId, {
        story,
        cutCount: input.cutCount,
        seriesId: input.seriesId,
      });
    }

    // 1. 사연 기반 '사전 에셋 자동 생성(Pre-Asset Generation)'
    try {
      const extractedEntities = await extractEntitiesFromStory(story);
      const currentAssets = await repo.listAssets();
      const targetSeriesId = input.seriesId ?? context.seriesId;
      const seriesAssetIds = [...context.assets.map((a) => a.id)];

      for (const ent of extractedEntities) {
        if (ent.role === "protagonist") continue;
        const existing = currentAssets.find((a) => a.name === ent.name && a.kind === ent.kind);
        if (existing) {
          if (!seriesAssetIds.includes(existing.id)) seriesAssetIds.push(existing.id);
        } else {
          const created = await repo.createAsset({
            kind: ent.kind,
            name: ent.name,
            description: ent.visualDna,
            tags: ent.tags,
          });
          seriesAssetIds.push(created.id);
        }
      }
      await repo.setSeriesAssets(targetSeriesId, seriesAssetIds);
    } catch (e) {
      console.error("[generateStoryboardAction] Pre-Asset generation error:", e);
    }

    const { context: freshContext } = await ownedEpisode(input.episodeId);

    const charDescs = freshContext.assets
      .filter((a) => a.kind === "character")
      .map((a) => ({
        name: a.name,
        description: a.description ?? undefined,
        tags: a.tags,
      }));

    // 시리즈 규칙과 고정 캐릭터는 화면이 아니라 서버가 읽는다.
    // 클라이언트가 보낸 값을 그대로 프롬프트에 넣으면 규칙을 우회할 수 있다.
    const result = await generateStoryboard({
      story,
      episodeId: freshContext.episodeId,
      seriesId: freshContext.seriesId,
      cutCount: input.cutCount ?? freshContext.cutCount,
      seriesRule: describeRule(freshContext),
      fixedCharacters: characterNames(freshContext),
      characterDescriptions: charDescs,
    });

    if (!result.ok) {
      if ("safety" in result) {
        return { ok: false, kind: "safety", message: result.safety.message! };
      }
      return { ok: false, kind: "error", message: result.error };
    }

    const store = await getGenerationStore();
    await store.saveStoryboard(result.storyboard, result.usedMock);
    return { ok: true, data: { storyboard: result.storyboard, usedMock: result.usedMock } };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** 콘티 편집(순서·추가·삭제·대사·후킹·CTA 선택) 자동 저장. */
export async function saveStoryboardAction(storyboard: Storyboard): Promise<ActionResult<null>> {
  try {
    const { context } = await ownedEpisode(storyboard.episodeId);
    const store = await getGenerationStore();
    const saved = await store.getStoryboard(context.episodeId);
    const checked = checkStoryboard(storyboard, context);
    await store.saveStoryboard(
      checked,
      saved?.usedMock ?? !isAnthropicConfigured(),
    );

    // 콘티에서 빠진 컷 레코드가 있으면 동기화하여 정리
    const activeCutIds = new Set(checked.cuts.map((c) => c.id));
    const existingCuts = await store.listCuts(context.episodeId);
    for (const c of existingCuts) {
      if (!activeCutIds.has(c.cutId)) {
        await store.deleteCut(context.episodeId, c.cutId);
      }
    }

    // 새로 등록된 등장인물이 있으면 전체 에셋 라이브러리 및 시리즈 에셋에 자동 동기화
    try {
      const repo = await getRepository();
      const currentAssets = await repo.listAssets();
      const seriesAssetIds = [...context.assets.map((a) => a.id)];
      let updatedSeries = false;

      for (const ch of checked.characters) {
        if (ch.key === "ch_me") continue;
        const name = ch.name.trim();
        if (!name) continue;
        const existing = currentAssets.find((a) => a.name === name && a.kind === "character");
        if (existing) {
          if (!seriesAssetIds.includes(existing.id)) {
            seriesAssetIds.push(existing.id);
            updatedSeries = true;
          }
        } else {
          const created = await repo.createAsset({
            kind: "character",
            name,
            description: `${name} (콘티에서 등록된 인물)`,
            tags: ["등장인물", "조연"],
          });
          seriesAssetIds.push(created.id);
          updatedSeries = true;
        }
      }
      if (updatedSeries) {
        await repo.setSeriesAssets(context.seriesId, seriesAssetIds);
      }
    } catch (e) {
      console.error("[saveStoryboardAction] Auto asset sync error:", e);
    }

    return { ok: true, data: null };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** 컷 삭제 액션 (콘티 또는 편집기에서 호출). */
export async function deleteCutAction(input: {
  episodeId: string;
  cutId: string;
}): Promise<ActionResult<{ remainingCutsCount: number }>> {
  try {
    const { context } = await ownedEpisode(input.episodeId);
    const store = await getGenerationStore();
    const saved = await store.getStoryboard(context.episodeId);
    if (!saved) return { ok: false, kind: "error", message: "콘티를 찾지 못했어요." };

    const cutIndex = saved.storyboard.cuts.findIndex((c) => c.id === input.cutId);
    if (cutIndex < 0) return { ok: false, kind: "error", message: "삭제할 컷을 찾지 못했어요." };

    if (saved.storyboard.cuts.length <= 1) {
      return { ok: false, kind: "error", message: "최소 1개의 컷은 유지되어야 해요." };
    }

    const remainingCuts = saved.storyboard.cuts
      .filter((c) => c.id !== input.cutId)
      .map((c, i) => ({ ...c, index: i + 1 }));

    const updatedStoryboard: Storyboard = {
      ...saved.storyboard,
      cuts: remainingCuts,
    };

    await store.saveStoryboard(updatedStoryboard, saved.usedMock);
    await store.deleteCut(input.episodeId, input.cutId);

    revalidatePath(`/episodes/${input.episodeId}/editor`);
    revalidatePath(`/episodes/${input.episodeId}/generate`);
    revalidatePath(`/episodes/${input.episodeId}/publish`);

    return { ok: true, data: { remainingCutsCount: remainingCuts.length } };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** PRD 3.1.1 — 에이전트 모드 전체 생성. 지금 화면의 콘티를 저장하고 그 사본으로 돌린다. */
export async function startGenerationAction(
  storyboard: Storyboard,
  tier: GenerationTier = "standard",
): Promise<ActionResult<GenerationJob>> {
  try {
    const { context, userId } = await ownedEpisode(storyboard.episodeId);
    const checked = checkStoryboard(storyboard, context);

    const store = await getGenerationStore();
    const saved = await store.getStoryboard(context.episodeId);
    await store.saveStoryboard(checked, saved?.usedMock ?? !isAnthropicConfigured());

    const result = await startGeneration({
      userId,
      storyboard: checked,
      mode: "agent",
      tier,
      ...generationRefs(context),
    });

    if (!result.ok) {
      return result.reason === "safety"
        ? { ok: false, kind: "safety", message: result.message }
        : { ok: false, kind: "error", message: result.message };
    }

    kickQueue();

    // 이 회차가 실제로 쓴 에셋. 에셋을 바꿀 때 영향받는 회차를 이걸로 보여준다(PRD 2.1).
    await (await getRepository()).recordAssetReferences(
      context.episodeId,
      context.assets.map((a) => a.id),
    );
    revalidatePath("/home");
    return { ok: true, data: result.job };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** PRD 3.1.2 — 한 컷만 다시. */
export async function regenerateCutAction(input: {
  episodeId: string;
  jobId?: string;
  cutId: string;
  intent: CutEditIntent;
  tier?: GenerationTier;
  prompt?: string;
  skipFaceLock?: boolean;
  maskUrl?: string;
}): Promise<ActionResult<null>> {
  try {
    const { userId } = await ownedEpisode(input.episodeId);
    let jobId = input.jobId;
    if (!jobId) {
      const store = await getGenerationStore();
      const latestJob = await store.getLatestJob(input.episodeId);
      jobId = latestJob?.id;
    }
    if (!jobId) {
      return { ok: false, kind: "error", message: "생성 작업을 찾지 못했어요" };
    }

    const result = await regenerateCut({
      jobId,
      userId,
      cutId: input.cutId,
      intent: input.intent,
      tier: input.tier,
      prompt: input.prompt?.slice(0, 200),
      skipFaceLock: input.skipFaceLock,
      maskUrl: input.maskUrl,
    });
    if (!result.ok) {
      return { ok: false, kind: "safety", message: result.message ?? "다시 만들 수 없어요" };
    }
    kickQueue();
    return { ok: true, data: null };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** 실패한 컷만 재시도. 성공한 컷은 건드리지 않는다. */
export async function retryFailedCutsAction(input: {
  episodeId: string;
  jobId: string;
  skipFaceLock?: boolean;
}): Promise<ActionResult<null>> {
  try {
    const { userId } = await ownedEpisode(input.episodeId);
    const result = await retryFailedCuts({ jobId: input.jobId, userId, skipFaceLock: input.skipFaceLock });
    if (!result.ok) return { ok: false, kind: "error", message: result.message ?? "다시 만들 수 없어요" };
    kickQueue();
    return { ok: true, data: null };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** PRD 3.2 — 편집기 자동 저장(3초 디바운스). */
export async function saveLayerTreeAction(input: {
  episodeId: string;
  tree: CutLayerTree;
}): Promise<ActionResult<null>> {
  try {
    await ownedEpisode(input.episodeId);
    const store = await getGenerationStore();
    await store.saveLayerTree(input.episodeId, input.tree.cutId, checkLayerTree(input.tree));
    return { ok: true, data: null };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** PRD 4.1 — 캡션 3안·해시태그·첫 댓글. 크레딧을 쓰지 않는다. */
export async function generatePostPackageAction(
  episodeId: string,
): Promise<ActionResult<PostPackage>> {
  try {
    const { context } = await ownedEpisode(episodeId);
    const store = await getGenerationStore();
    const saved = await store.getStoryboard(episodeId);
    if (!saved) return { ok: false, kind: "error", message: "콘티가 있어야 게시물을 만들 수 있어요." };

    const result = await generatePostPackage({ context, storyboard: saved.storyboard });
    if (!result.ok) {
      return result.reason === "refusal"
        ? { ok: false, kind: "safety", message: "이 내용으로는 캡션을 만들 수 없어요." }
        : { ok: false, kind: "error", message: result.message };
    }
    await store.savePostPackage(episodeId, result.data);
    return { ok: true, data: { ...result.data, updatedAt: new Date().toISOString() } };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** 첫 댓글만 다시 쓰기. 크레딧을 쓰지 않는다. */
export async function generateFirstCommentAction(
  episodeId: string,
): Promise<ActionResult<string>> {
  try {
    const { context } = await ownedEpisode(episodeId);
    const store = await getGenerationStore();
    const saved = await store.getStoryboard(episodeId);
    if (!saved) return { ok: false, kind: "error", message: "콘티가 있어야 댓글을 만들 수 있어요." };

    const result = await generateFirstComment({ context, storyboard: saved.storyboard });
    if (!result.ok) {
      return result.reason === "refusal"
        ? { ok: false, kind: "safety", message: "이 내용으로는 댓글을 만들 수 없어요." }
        : { ok: false, kind: "error", message: result.message };
    }

    const prev = await store.getPostPackage(episodeId);
    if (prev) {
      await store.savePostPackage(episodeId, {
        ...prev,
        firstComment: result.data,
      });
    }

    return { ok: true, data: result.data };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** 게시물 패키지를 손으로 고친 것. */
export async function savePostPackageAction(
  episodeId: string,
  pkg: Omit<PostPackage, "updatedAt" | "usedMock">,
): Promise<ActionResult<null>> {
  try {
    await ownedEpisode(episodeId);
    const store = await getGenerationStore();
    const prev = await store.getPostPackage(episodeId);
    const clip = (s: string, n: number) => String(s ?? "").slice(0, n);
    const tags = (list: string[]) =>
      (Array.isArray(list) ? list : []).slice(0, 30).map((t) => clip(t, 60));
    await store.savePostPackage(episodeId, {
      captions: {
        short: clip(pkg.captions.short, 2200),
        emotional: clip(pkg.captions.emotional, 2200),
        humor: clip(pkg.captions.humor, 2200),
      },
      hashtags: { fixed: tags(pkg.hashtags.fixed), dynamic: tags(pkg.hashtags.dynamic) },
      firstComment: clip(pkg.firstComment, 2200),
      usedMock: prev?.usedMock ?? false,
    });
    return { ok: true, data: null };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** 인스타에 올렸다고 표시한다. 첫 게시 완주율의 분자다. */
export async function markPublishedAction(episodeId: string): Promise<ActionResult<null>> {
  try {
    await ownedEpisode(episodeId);
    await (await getGenerationStore()).markPublished(episodeId);
    revalidatePath("/home");
    return { ok: true, data: null };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** 목 데이터로 돌고 있는지. 화면이 배지로 알린다. */
export async function generationEnvAction(): Promise<{ anthropic: boolean }> {
  return { anthropic: isAnthropicConfigured() };
}

function toCreditOrError(e: unknown): ActionResult<never> {
  if (e instanceof InsufficientCreditError) {
    return {
      ok: false,
      kind: "credit",
      message: e.message,
      required: e.required,
      available: e.available,
    };
  }
  if (!(e instanceof ActionError)) console.error("[generation action]", e);
  return {
    ok: false,
    kind: "error",
    message: e instanceof ActionError ? e.message : "처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.",
  };
}

/** 생성 호출에 실릴 고정 레퍼런스. 캐릭터 시트는 모든 호출에 들어간다(PRD 2.1). */
function generationRefs(context: EpisodeContext) {
  const characters = context.assets.filter((a) => a.kind === "character");
  const characterTraits = characters.map((c) => {
    const details = [
      c.name,
      c.tags && c.tags.length > 0 ? `특징: ${c.tags.join(", ")}` : "",
      c.description ? `외모/설정: ${c.description}` : "",
    ].filter(Boolean).join(" · ");
    return details;
  }).filter(Boolean);

  return {
    characterAssetIds: characters.map((a) => a.id),
    assetIds: context.assets.filter((a) => a.kind !== "character").map((a) => a.id),
    characterSheetRefs: characters.flatMap((a) => [
      ...(a.referenceUrls ?? []),
      ...(a.thumbUrl ? [a.thumbUrl] : []),
    ]),
    assetRefs: context.assets
      .filter((a) => a.kind !== "character")
      .flatMap((a) => [
        ...(a.referenceUrls ?? []),
        ...(a.thumbUrl ? [a.thumbUrl] : []),
      ]),
    seriesRule: {
      ...context.rule,
      characterTraits,
    },
  };
}

/** 시리즈 규칙을 프롬프트 한 줄로 만든다. 모델이 읽을 값이라 사람 말로 적는다. */
function describeRule(context: EpisodeContext): string {
  const { stylePreset, aspectRatio, tone } = context.rule;
  return [`그림체 ${stylePreset}`, `비율 ${aspectRatio}`, tone ? `말투 ${tone}` : null]
    .filter(Boolean)
    .join(", ");
}

/** 고정 캐릭터 이름. 사연에 안 나와도 이 이름을 쓰게 한다. */
function characterNames(context: EpisodeContext): string[] {
  return context.assets.filter((a) => a.kind === "character").map((a) => a.name);
}

/**
 * 화면이 보낸 콘티를 믿을 수 있는 모양으로 줄인다. 회차·시리즈 id 는 서버 값으로 덮고,
 * 컷 수와 글자 수는 상한을 건다(캐러셀 10장, 장면 500자).
 */
function checkStoryboard(sb: Storyboard, context: EpisodeContext): Storyboard {
  if (!Array.isArray(sb.cuts) || sb.cuts.length < 1 || sb.cuts.length > 10) {
    throw new ActionError("컷은 1개에서 10개까지예요.");
  }
  const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);
  const ids = new Set<string>();
  const cuts = sb.cuts.map((c, i) => {
    const id = clip(c.id, 64);
    if (!id || ids.has(id)) throw new ActionError("컷 정보가 어긋났어요. 새로고침해 주세요.");
    ids.add(id);
    return {
      ...c,
      id,
      index: i + 1,
      scene: clip(c.scene, 500),
      narration: c.narration == null ? undefined : clip(c.narration, 200),
      characterIds: (c.characterIds ?? []).slice(0, 8).map((k) => clip(k, 40)),
      dialogue: (c.dialogue ?? []).slice(0, 8).map((l) => ({ ...l, id: clip(l.id, 64), text: clip(l.text, 120) })),
    };
  });
  if (cuts.some((c) => !c.scene.trim())) {
    throw new ActionError("장면이 빈 컷이 있어요. 장면을 적거나 컷을 지워 주세요.");
  }
  return {
    ...sb,
    episodeId: context.episodeId,
    seriesId: context.seriesId,
    story: clip(sb.story, 500),
    characters: (sb.characters ?? []).slice(0, 12),
    cuts,
    updatedAt: new Date().toISOString(),
  };
}

/** 레이어 트리 상한. 한 컷에 레이어 60개, 글자 500자. */
function checkLayerTree(tree: CutLayerTree): CutLayerTree {
  if (!tree || typeof tree.cutId !== "string" || !Array.isArray(tree.layers)) {
    throw new ActionError("편집 내용을 읽지 못했어요.");
  }
  if (tree.layers.length > 60) throw new ActionError("레이어는 60개까지예요.");
  if (JSON.stringify(tree).length > 200_000) throw new ActionError("편집 내용이 너무 커요.");
  return {
    cutId: tree.cutId,
    canvas: { width: Number(tree.canvas?.width) || 1080, height: Number(tree.canvas?.height) || 1080 },
    // 생성 이미지 URL 은 서명 URL 이라 만료된다. 저장하지 않고 불러올 때 다시 붙인다.
    layers: tree.layers.map((l) =>
      "imageUrl" in l ? { ...l, imageUrl: "" } : { ...l, text: String(l.text ?? "").slice(0, 500) },
    ),
  };
}
