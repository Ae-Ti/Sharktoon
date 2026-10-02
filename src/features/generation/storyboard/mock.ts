/**
 * 목 콘티 — ANTHROPIC_API_KEY 가 없을 때.
 *
 * 예전에는 고정된 예시 콘티(팀장님·강아지)를 돌려줘서, 무슨 사연을 넣어도 같은 이야기가
 * 나오고 컷 수(4·6·8)도 무시됐다. 실 테스트에서 "내 사연이 아니다"가 첫 반응이었다.
 * 모델 없이도 입력한 사연과 컷 수가 그대로 보이도록 사연 문장으로 콘티 틀을 짠다.
 * 문장을 잘 쓰는 건 모델의 일이고, 여기서는 구조(후킹·전개·전환·CTA)만 맞춘다.
 */

import type {
  CameraShot,
  CtaOption,
  CopyOption,
  CutEmotion,
  Storyboard,
  StoryboardCharacter,
  StoryboardCut,
} from "../types/storyboard";

export interface MockStoryboardInput {
  episodeId: string;
  seriesId: string;
  story: string;
  cutCount: number;
  fixedCharacters?: string[];
}

/** 컷 역할. 인스타툰 문법(prompt.ts)과 같은 순서다. */
const ROLE_PLAN: { role: string; emotion: CutEmotion; camera: CameraShot }[] = [
  { role: "후킹", emotion: "surprised", camera: "close_up" },
  { role: "전개", emotion: "anxious", camera: "medium" },
  { role: "전개", emotion: "embarrassed", camera: "over_shoulder" },
  { role: "전환", emotion: "angry", camera: "close_up" },
  { role: "감정", emotion: "sad", camera: "wide" },
  { role: "감정", emotion: "determined", camera: "medium" },
  { role: "여운", emotion: "calm", camera: "wide" },
];

export function mockStoryboard(input: MockStoryboardInput): Storyboard {
  const now = new Date().toISOString();
  const id = idMaker();

  const characters: StoryboardCharacter[] = (
    input.fixedCharacters?.length ? input.fixedCharacters : ["나"]
  ).map((name, i) => ({ key: i === 0 ? "ch_me" : `ch_${i + 1}`, name }));
  const me = characters[0].key;

  const beats = splitBeats(input.story, input.cutCount);
  const count = Math.max(4, Math.min(10, input.cutCount));

  const cuts: StoryboardCut[] = Array.from({ length: count }, (_, i) => {
    const last = i === count - 1;
    const plan = last
      ? { role: "CTA", emotion: "calm" as const, camera: "wide" as const }
      : ROLE_PLAN[Math.min(i, ROLE_PLAN.length - 2)];
    const beat = beats[i] ?? beats[beats.length - 1];

    return {
      id: id("cut"),
      index: i + 1,
      scene: `${plan.role} — ${beat}`,
      characterIds: [me],
      emotion: plan.emotion,
      camera: plan.camera,
      dialogue:
        i === 0 || last
          ? []
          : [{ id: id("ln"), speakerId: me, text: short(beat, 18), balloon: i === 3 ? "shout" : "normal" }],
      narration: i === 0 ? short(beat, 24) : last ? "오늘은 여기까지." : undefined,
    };
  });

  const hook = short(beats[0], 22);
  const hookOptions: CopyOption[] = [
    { id: id("hook"), text: hook, rationale: "사연의 첫 장면을 그대로 던진다. 같은 일을 겪은 사람이 바로 멈춘다." },
    { id: id("hook"), text: `${short(beats[0], 14).replace(/…$/, "")}… 그날 무슨 일이?`, rationale: "결과를 숨겨서 다음 장을 넘기게 한다." },
    { id: id("hook"), text: `결국 ${short(beats[beats.length - 1], 16)}`, rationale: "결말을 먼저 보여주고 이유를 궁금하게 만든다." },
  ];
  const ctaOptions: CtaOption[] = [
    { id: id("cta"), kind: "like", text: "공감되면 좋아요로 알려주세요", rationale: "행동 부담이 가장 낮다. 첫 화 반응 모으기에 안전하다." },
    { id: id("cta"), kind: "next_episode", text: "다음 화 — 그 다음 날 이야기", rationale: "연재 의도를 바로 알린다. 팔로우 전환을 노릴 때." },
    { id: id("cta"), kind: "question", text: "여러분이라면 어떻게 했을까요?", rationale: "댓글을 직접 유도한다." },
  ];

  return {
    id: id("sb"),
    episodeId: input.episodeId,
    seriesId: input.seriesId,
    status: "draft",
    story: input.story,
    characters,
    cuts,
    hookOptions,
    selectedHookId: null,
    ctaOptions,
    selectedCtaId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** 사연을 문장 단위로 쪼갠다. 컷보다 문장이 적으면 마지막 문장을 다시 쓴다. */
function splitBeats(story: string, cutCount: number): string[] {
  const sentences = story
    .replace(/([.!?。…])\s+/g, "$1\n")
    .split(/\n+|,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const beats = sentences.length > 0 ? sentences : [story.trim() || "오늘 있었던 일"];
  return beats.slice(0, cutCount);
}

function short(text: string, max: number): string {
  const t = text.replace(/[.。]+$/, "");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** 한 콘티 안에서 유일하면 된다. 회차가 달라도 같은 id 를 쓰지 않게 난수를 섞는다. */
function idMaker() {
  const salt = crypto.randomUUID().slice(0, 6);
  let n = 0;
  return (prefix: string) => `${prefix}_${salt}${(++n).toString(36)}`;
}
