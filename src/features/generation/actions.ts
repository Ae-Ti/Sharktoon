"use server";

/**
 * 생성 영역 서버 액션 — 콘티, 생성, 편집, 게시물 패키지.
 *
 * 서버 액션은 화면 밖에서 POST 로 바로 부를 수 있다. 그래서 모든 액션이 먼저
 * `ownedEpisode()` 로 회차 소유를 확인한다(회차 컨텍스트 읽기가 RLS 를 탄다 —
 * 남의 회차면 null 이다). 화면이 보낸 콘티·레이어는 모양과 크기를 다시 본다.
 */

import { revalidatePath } from "next/cache";
import { InsufficientCreditError } from "@/contracts/credit";
import type { CutEditIntent, GenerationJob } from "@/contracts/generation";
import { getRepository } from "@/features/platform/data";
import { loadEpisodeContext, type EpisodeContext } from "@/features/platform/episode";
import { getGenerationStore, type PostPackage } from "./data";
import { generatePostPackage } from "./post/generate";
import { regenerateCut, retryFailedCuts, startGeneration, type JobOwnerInput } from "./pipeline";
import { generateStoryboard, isAnthropicConfigured } from "./storyboard/generate";
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
}): Promise<ActionResult<{ storyboard: Storyboard; usedMock: boolean }>> {
  try {
    const { context } = await ownedEpisode(input.episodeId);
    const story = (input.story ?? context.story).trim();
    if (story.length < 10) {
      return { ok: false, kind: "error", message: "사연을 조금 더 적어주세요. 한 문장이면 충분해요." };
    }

    // 시리즈 규칙과 고정 캐릭터는 화면이 아니라 서버가 읽는다.
    // 클라이언트가 보낸 값을 그대로 프롬프트에 넣으면 규칙을 우회할 수 있다.
    const result = await generateStoryboard({
      story,
      episodeId: context.episodeId,
      seriesId: context.seriesId,
      cutCount: context.cutCount,
      seriesRule: describeRule(context),
      fixedCharacters: characterNames(context),
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
    await store.saveStoryboard(
      checkStoryboard(storyboard, context),
      saved?.usedMock ?? !isAnthropicConfigured(),
    );
    return { ok: true, data: null };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** PRD 3.1.1 — 에이전트 모드 전체 생성. 지금 화면의 콘티를 저장하고 그 사본으로 돌린다. */
export async function startGenerationAction(
  storyboard: Storyboard,
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
      ...generationRefs(context),
    });

    if (!result.ok) {
      return result.reason === "safety"
        ? { ok: false, kind: "safety", message: result.message }
        : { ok: false, kind: "error", message: result.message };
    }

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

/** 재시작 뒤 잡을 다시 올릴 때 필요한 재료. */
function restoreFor(context: EpisodeContext): JobOwnerInput["restore"] {
  return async () => {
    const saved = await (await getGenerationStore()).getStoryboard(context.episodeId);
    return saved ? { storyboard: saved.storyboard, ...generationRefs(context) } : null;
  };
}

/** PRD 3.1.2 — 한 컷만 다시. */
export async function regenerateCutAction(input: {
  episodeId: string;
  jobId: string;
  cutId: string;
  intent: CutEditIntent;
  prompt?: string;
}): Promise<ActionResult<null>> {
  try {
    const { context, userId } = await ownedEpisode(input.episodeId);
    const result = await regenerateCut({
      jobId: input.jobId,
      userId,
      cutId: input.cutId,
      intent: input.intent,
      prompt: input.prompt?.slice(0, 200),
      restore: restoreFor(context),
    });
    if (!result.ok) {
      return { ok: false, kind: "safety", message: result.message ?? "다시 만들 수 없어요" };
    }
    return { ok: true, data: null };
  } catch (e) {
    return toCreditOrError(e);
  }
}

/** 실패한 컷만 재시도. 성공한 컷은 건드리지 않는다. */
export async function retryFailedCutsAction(input: {
  episodeId: string;
  jobId: string;
}): Promise<ActionResult<null>> {
  try {
    const { context, userId } = await ownedEpisode(input.episodeId);
    const result = await retryFailedCuts({
      jobId: input.jobId,
      userId,
      restore: restoreFor(context),
    });
    if (!result.ok) return { ok: false, kind: "error", message: result.message ?? "다시 만들 수 없어요" };
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
  return {
    characterSheetRefs: context.assets
      .filter((a) => a.kind === "character")
      .flatMap((a) => a.referenceUrls),
    assetRefs: context.assets
      .filter((a) => a.kind !== "character")
      .flatMap((a) => a.referenceUrls),
    seriesRule: { ...context.rule },
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
