/**
 * 4.1 인스타 게시물 패키지 — 캡션 3안, 해시태그 15~25개, 첫 댓글.
 *
 * 콘티와 같은 LLM 경로(구조화 출력)를 쓴다. 크레딧을 쓰지 않는다(정책: 캡션 생성은 무료).
 * ANTHROPIC_API_KEY 가 없으면 콘티에서 바로 뽑은 목 패키지를 준다.
 */

import "server-only";

import { z } from "zod";
import type { EpisodeContext } from "@/features/platform/episode";
import type { PostPackage } from "../data/types";
import { isAnthropicConfigured, parseStructured, type StructuredResult } from "../llm";
import type { Storyboard } from "../types/storyboard";

/** 해시태그 총량. 대중 태그와 니치 태그를 섞어 15~25개(PRD 4.1). */
export const HASHTAG_MIN = 15;
export const HASHTAG_MAX = 25;

const PostSchema = z.object({
  captions: z.object({
    /** 짧게 — 한두 줄. */
    short: z.string(),
    /** 감성 — 공감을 끌어내는 서너 줄. */
    emotional: z.string(),
    /** 유머 — 자조·드립. */
    humor: z.string(),
  }),
  /** 대중 태그(검색량 큰 것). # 없이. */
  popular_hashtags: z.array(z.string()),
  /** 니치 태그(이 화의 소재·감정에 딱 맞는 것). # 없이. */
  niche_hashtags: z.array(z.string()),
  /** 첫 댓글. 다음 화 예고나 질문으로 대화를 연다. */
  first_comment: z.string(),
});

const SYSTEM = `너는 한국 인스타툰 작가의 게시물 담당이다. 완성된 화 하나의 콘티를 받아 인스타그램 게시물 문구를 만든다.

본문(captions) 3안:
- short: 한두 줄. 1컷 후킹을 반복하지 말고, 넘겨 보게 만드는 한 마디.
- emotional: 서너 줄. 같은 일을 겪은 사람이 "내 얘기"라고 느끼게. 설명하지 말고 장면으로.
- humor: 자조나 드립. 상황을 한 발 떨어져서 본다.
- 셋 다 시리즈 말투 규칙이 있으면 반드시 따른다. 해시태그를 본문에 넣지 않는다.

해시태그:
- popular_hashtags 는 인스타툰을 찾는 사람이 실제로 검색하는 넓은 태그(인스타툰, 일상툰 같은 것).
- niche_hashtags 는 이 화의 소재·감정·상황에 딱 맞는 좁은 태그.
- 둘을 합쳐 15개 이상 25개 이하. # 기호와 공백 없이 단어만 쓴다. 시리즈 고정 해시태그와 겹치지 않게 한다.
- 실존 인물·브랜드·다른 작품 이름은 태그로 쓰지 않는다.

first_comment: 작가가 직접 다는 첫 댓글. 질문이나 다음 화 예고로 대화를 연다. 한두 줄.`;

export type PostPackageDraft = Omit<PostPackage, "updatedAt">;

export async function generatePostPackage(input: {
  context: EpisodeContext;
  storyboard: Storyboard;
}): Promise<StructuredResult<PostPackageDraft>> {
  const fixed = normalizeTags(input.context.rule.fixedHashtags);

  if (!isAnthropicConfigured()) {
    return { ok: true, data: mockPostPackage(input.storyboard, fixed) };
  }

  const result = await parseStructured({
    schema: PostSchema,
    system: SYSTEM,
    user: buildUserMessage(input),
  });
  if (!result.ok) return result;

  const dynamic = fitDynamicTags(
    [...result.data.popular_hashtags, ...result.data.niche_hashtags],
    fixed,
  );
  return {
    ok: true,
    data: {
      captions: result.data.captions,
      hashtags: { fixed, dynamic },
      firstComment: result.data.first_comment,
      usedMock: false,
    },
  };
}

function buildUserMessage({ context, storyboard }: { context: EpisodeContext; storyboard: Storyboard }) {
  const hook = storyboard.hookOptions.find((h) => h.id === storyboard.selectedHookId)?.text;
  const cta = storyboard.ctaOptions.find((c) => c.id === storyboard.selectedCtaId)?.text;
  const cuts = storyboard.cuts
    .map((c) => {
      const lines = c.dialogue.map((l) => l.text).join(" / ");
      return `${c.index}컷: ${c.scene}${lines ? ` | 대사: ${lines}` : ""}${c.narration ? ` | 나레이션: ${c.narration}` : ""}`;
    })
    .join("\n");

  return [
    `시리즈: ${context.seriesTitle} ${context.number}화`,
    context.rule.tone ? `시리즈 말투 규칙: ${context.rule.tone}` : null,
    context.rule.fixedHashtags.length ? `시리즈 고정 해시태그: ${context.rule.fixedHashtags.join(" ")}` : null,
    hook ? `1컷 후킹: ${hook}` : null,
    cta ? `마지막 컷 CTA: ${cta}` : null,
    `콘티:\n${cuts}`,
    `사연 원문:\n${storyboard.story}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** "#직장 상사" → "직장상사". 화면에서 # 을 붙여 보여준다. */
export function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const clean = t.replace(/^#+/, "").replace(/\s+/g, "").trim();
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out;
}

/** 동적 태그를 고정 태그와 겹치지 않게 하고, 합계가 15~25 안에 들게 자른다. */
export function fitDynamicTags(candidates: string[], fixed: string[]): string[] {
  const dynamic = normalizeTags(candidates).filter((t) => !fixed.includes(t));
  return dynamic.slice(0, Math.max(0, HASHTAG_MAX - fixed.length));
}

const POPULAR = ["인스타툰", "일상툰", "공감툰", "웹툰", "만화", "그림일기", "일상", "공감", "직장인", "직장인공감", "소소한일상", "오늘의기록", "툰스타그램", "그림스타그램", "드로잉"];

/** 모델 없이 만든 패키지. 콘티의 문장과 감정으로 채운다. */
export function mockPostPackage(storyboard: Storyboard, fixed: string[]): PostPackageDraft {
  const hook = storyboard.hookOptions.find((h) => h.id === storyboard.selectedHookId)?.text
    ?? storyboard.cuts[0]?.scene ?? storyboard.story;
  const story = storyboard.story.replace(/\s+/g, " ").trim();
  // 모델 없이 고르는 니치 태그. 조사·어미로 끝나는 말("갔다", "눈을")은 태그가 안 된다.
  const words = normalizeTags(
    story
      .split(/[\s,.!?]+/)
      .map((w) => w.replace(/(에서|으로|에게|까지|부터|처럼|이랑|하고|은|는|이|가|을|를|에|의|도|로|와|과)$/, ""))
      .filter((w) => w.length >= 2 && w.length <= 8 && !/(다|니|고|서|면|며|게|지|요|죠)$/.test(w))
      .slice(0, 6),
  );
  const dynamic = fitDynamicTags([...POPULAR, ...words], fixed);
  // 최소 개수가 안 되면 대중 태그로 채운다.
  while (fixed.length + dynamic.length < HASHTAG_MIN && dynamic.length < POPULAR.length) {
    const next = POPULAR.find((p) => !dynamic.includes(p) && !fixed.includes(p));
    if (!next) break;
    dynamic.push(next);
  }

  return {
    captions: {
      short: `${hook}`,
      emotional: `${story}\n\n그날 아무 말도 못 한 나에게.\n여러분도 이런 날 있었죠?`,
      humor: `오늘의 교훈: ${story.slice(0, 30)}${story.length > 30 ? "…" : ""}\n(교훈은 없다)`,
    },
    hashtags: { fixed, dynamic },
    firstComment: "여러분이라면 그때 뭐라고 했을까요? 댓글로 알려주세요 👇",
    usedMock: true,
  };
}
