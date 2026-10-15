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
/** 컷 역할. 인스타툰 4단 극적 비트(Hook ➡️ Escalation ➡️ Crisis ➡️ Resolution)에 맞춘 리듬 */
const ROLE_PLAN: { role: string; emotion: CutEmotion; camera: CameraShot }[] = [
  { role: "후킹(상황 착수)", emotion: "surprised", camera: "medium" },
  { role: "전개(긴장 고조)", emotion: "anxious", camera: "wide" },
  { role: "전환(코믹 위기)", emotion: "angry", camera: "close_up" },
  { role: "해결(수습·결말)", emotion: "joy", camera: "top_down" },
  { role: "빌드업", emotion: "embarrassed", camera: "over_shoulder" },
  { role: "감정 폭발", emotion: "sad", camera: "wide" },
  { role: "결심", emotion: "determined", camera: "medium" },
  { role: "여운", emotion: "calm", camera: "wide" },
];

interface ChatLine {
  speaker: string;
  text: string;
}

function parseChatLines(story: string): ChatLine[] {
  const rawLines = story.split("\n").map((l) => l.trim()).filter(Boolean);
  const result: ChatLine[] = [];

  for (const line of rawLines) {
    // 1. [홍길동] [오후 2:30] 대사 또는 [홍길동] 대사
    const bracketMatch = line.match(/^\[([^\]]+)\](?:\s*\[[^\]]+\])?\s*(.+)$/);
    if (bracketMatch) {
      result.push({ speaker: bracketMatch[1].trim(), text: bracketMatch[2].trim() });
      continue;
    }
    // 2. 홍길동: 대사
    const colonMatch = line.match(/^([^:\n]{1,15})\s*[:：]\s*(.+)$/);
    if (colonMatch) {
      result.push({ speaker: colonMatch[1].trim(), text: colonMatch[2].trim() });
      continue;
    }
  }
  return result;
}

export function mockStoryboard(input: MockStoryboardInput): Storyboard {
  const now = new Date().toISOString();
  const id = idMaker();
  const count = Math.max(1, Math.min(20, input.cutCount));

  const chatLines = parseChatLines(input.story);
  const isChat = chatLines.length >= 2;

  let characters: StoryboardCharacter[];
  if (input.fixedCharacters?.length) {
    characters = input.fixedCharacters.map((name, i) => ({
      key: i === 0 ? "ch_me" : `ch_${i + 1}`,
      name,
    }));
  } else if (isChat) {
    const rawSpeakers = Array.from(new Set(chatLines.map((c) => c.speaker)));
    const meSpeaker = rawSpeakers.find((s) => s === "나" || s === "주인공");
    const otherSpeakers = rawSpeakers.filter((s) => s !== meSpeaker);

    const orderedSpeakers = meSpeaker ? [meSpeaker, ...otherSpeakers] : rawSpeakers;
    characters = orderedSpeakers.map((name, i) => ({
      key: i === 0 ? "ch_me" : `ch_${i + 1}`,
      name,
    }));
  } else {
    characters = [{ key: "ch_me", name: "나" }];
  }

  const me = characters[0].key;
  const nameToKey = new Map(characters.map((c) => [c.name, c.key]));

  const beats = splitBeats(input.story, count);

  const cuts: StoryboardCut[] = Array.from({ length: count }, (_, i) => {
    const last = i === count - 1;
    const plan = last
      ? { role: "CTA(결말)", emotion: "calm" as const, camera: "top_down" as const }
      : ROLE_PLAN[Math.min(i, ROLE_PLAN.length - 2)];
    const beat = beats[i] ?? beats[beats.length - 1];

    let dialogue: StoryboardCut["dialogue"] = [];
    let cutCharIds: string[] = [me];
    let scene = `${plan.role} — ${beat}`;

    if (isChat) {
      // 카톡 대화록인 경우: 컷당 대화 1~2줄 배치
      const startIdx = Math.floor((i / count) * chatLines.length);
      const endIdx = Math.min(chatLines.length, Math.floor(((i + 1) / count) * chatLines.length));
      const cutChats = chatLines.slice(startIdx, Math.max(startIdx + 1, endIdx));

      dialogue = cutChats.map((c) => {
        const spKey = nameToKey.get(c.speaker) ?? me;
        if (!cutCharIds.includes(spKey)) cutCharIds.push(spKey);
        const isShout = c.text.includes("!") || c.text.includes("?");
        return {
          id: id("ln"),
          speakerId: spKey,
          text: short(c.text, 20),
          balloon: isShout ? "shout" : "normal",
        };
      });

      const speakersInCut = Array.from(
        new Set(cutChats.map((c) => c.speaker)),
      ).join(", ");
      scene = `스마트폰 화면과 인물의 만화적 리액션. ${speakersInCut}의 대화 상황: "${short(cutChats[0]?.text || beat, 25)}"`;
    } else {
      dialogue =
        i === 0 || last
          ? []
          : [{ id: id("ln"), speakerId: me, text: short(beat, 18), balloon: i === 2 ? "shout" : "normal" }];
    }

    const narrText = i === 0 ? short(beat, 24) : last ? "오늘은 여기까지." : undefined;
    if (narrText) {
      dialogue.unshift({
        id: id("ln"),
        speakerId: null,
        text: narrText,
        balloon: "narration_box",
      });
    }

    return {
      id: id("cut"),
      index: i + 1,
      scene,
      characterIds: cutCharIds,
      emotion: plan.emotion,
      camera: plan.camera,
      dialogue,
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

/** 사연을 문장 단위로 쪼개고, 컷 수에 맞추어 이야기의 처음-중간-끝이 고르게 반영되도록 배분한다. */
function splitBeats(story: string, cutCount: number): string[] {
  const sentences = story
    .replace(/([.!?。…])\s+/g, "$1\n")
    .split(/\n+|,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [story.trim() || "오늘 있었던 일"];
  if (sentences.length <= cutCount) {
    return sentences;
  }

  // 장문 사연의 경우 전체 서사(기승전결)를 균등하게 샘플링
  const result: string[] = [];
  for (let i = 0; i < cutCount; i++) {
    const idx = Math.floor((i / (cutCount - 1)) * (sentences.length - 1));
    result.push(sentences[idx]);
  }
  return result;
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
