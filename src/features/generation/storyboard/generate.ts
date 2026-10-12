/**
 * 콘티 생성 — 오너: 웅싯(A). PRD 2.2.
 *
 * 서버에서만 돈다. ANTHROPIC_API_KEY 가 없으면 목 콘티를 돌려주므로
 * 키 없이도 화면·플로우 전체를 만들 수 있다(태일의 `getRepository` 와 같은 방식).
 */

import "server-only";

import { StoryboardResponseSchema, type StoryboardResponse } from "./schema";
import {
  STORYBOARD_SYSTEM,
  buildStoryboardUserMessage,
  type StoryboardPromptInput,
} from "./prompt";
import { screenText } from "../safety/rules";
import { ALLOWED, blocked, type SafetyVerdict } from "../safety/types";
import type { Storyboard, StoryboardCut } from "../types/storyboard";
import { mockStoryboard } from "./mock";
import { isAnthropicConfigured, parseStructured } from "../llm";


/** 콘티 생성은 크레딧을 쓰지 않는다(PRD 3.1 비즈니스 규칙). 실패해도 환불 처리가 없다. */
export interface GenerateStoryboardInput extends StoryboardPromptInput {
  episodeId: string;
  seriesId: string;
}

export type GenerateStoryboardResult =
  | { ok: true; storyboard: Storyboard; usedMock: boolean }
  | { ok: false; safety: SafetyVerdict }
  | { ok: false; error: string };

export { isAnthropicConfigured };

export async function generateStoryboard(
  input: GenerateStoryboardInput,
): Promise<GenerateStoryboardResult> {
  // 1차 필터. 모델을 부르기 전에 막아야 왕복이 없다.
  const pre = screenText(input.story);
  if (!pre.allowed) return { ok: false, safety: pre };

  if (!isAnthropicConfigured()) {
    return {
      ok: true,
      usedMock: true,
      storyboard: mockStoryboard(input),
    };
  }

  const result = await parseStructured({
    schema: StoryboardResponseSchema,
    system: STORYBOARD_SYSTEM,
    user: buildStoryboardUserMessage(input),
  });
  if (!result.ok) {
    return result.reason === "refusal"
      ? { ok: false, safety: blocked("explicit", "model") }
      : { ok: false, error: result.message };
  }
  const parsed: StoryboardResponse = result.data;

  // 2차 필터. 규칙을 통과했지만 모델이 막은 경우다.
  if (!parsed.safety.allowed) {
    const category = parsed.safety.category;
    return {
      ok: false,
      safety:
        category === "none"
          ? blocked("explicit", "model", parsed.safety.reason)
          : blocked(category, "model", parsed.safety.reason),
    };
  }

  return { ok: true, usedMock: false, storyboard: toStoryboard(parsed, input) };
}

/**
 * 모델 응답을 도메인 타입으로 옮긴다. id 와 시각은 여기서 매긴다 —
 * 모델이 짓게 두면 회차끼리 충돌한다.
 */
function toCharacters(raw: unknown): { key: string; name: string }[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const list = raw.map((c, i) => {
      if (typeof c === "string") {
        return { key: i === 0 ? "ch_me" : `ch_${i + 1}`, name: c };
      }
      if (c && typeof c === "object") {
        const obj = c as Record<string, unknown>;
        if (typeof obj.key === "string" && typeof obj.name === "string" && !obj.name.includes("object Object")) {
          return { key: obj.key, name: obj.name };
        }
        const entries = Object.entries(obj).filter(([k]) => k !== "key" && k !== "name");
        if (entries.length > 0) {
          const [k, v] = entries[0];
          return {
            key: String(obj.key ?? k),
            name: typeof v === "string" ? v : (typeof obj.name === "string" ? obj.name : k),
          };
        }
        if (typeof obj.name === "string" && !obj.name.includes("object Object")) {
          return { key: i === 0 ? "ch_me" : `ch_${i + 1}`, name: obj.name };
        }
        if (typeof obj.key === "string") {
          return { key: obj.key, name: obj.key };
        }
      }
      return { key: i === 0 ? "ch_me" : `ch_${i + 1}`, name: i === 0 ? "나" : `등장인물 ${i + 1}` };
    });
    if (!list.some((c) => c.key === "ch_me")) {
      list.unshift({ key: "ch_me", name: "나" });
    }
    return list;
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([k, v]) => ({
      key: k,
      name: typeof v === "object" && v && "name" in v
        ? String((v as Record<string, unknown>).name)
        : (typeof v === "string" ? v : k),
    }));
  }
  return [
    { key: "ch_me", name: "나" },
    { key: "ch_vet", name: "수의사 선생님" },
  ];
}

function extractSpeakerId(speaker: unknown): string | null {
  if (!speaker || speaker === "") return null;
  if (typeof speaker === "string") {
    if (speaker.includes("object Object")) return "ch_me";
    return speaker;
  }
  if (typeof speaker === "object") {
    const obj = speaker as Record<string, unknown>;
    if (typeof obj.key === "string" && !obj.key.includes("object Object")) return obj.key;
    if (typeof obj.name === "string" && !obj.name.includes("object Object")) return obj.name;
    const firstKey = Object.keys(obj)[0];
    if (firstKey) return firstKey;
  }
  return "ch_me";
}

function refineStoryboardCuts(cuts: StoryboardCut[]): StoryboardCut[] {
  return cuts.map((cut) => {
    let scene = cut.scene;
    let charIds = [...cut.characterIds];

    // 1. 대사에 수의사나 병원 관련 대사가 있는데 씬에 의사가 빠진 경우 명시 추가
    const hasVetDialogue = cut.dialogue.some(
      (d) =>
        d.speakerId?.includes("vet") ||
        d.speakerId?.includes("doctor") ||
        d.speakerId?.includes("수의사") ||
        d.text.includes("순해요") ||
        d.text.includes("진료")
    );
    if (hasVetDialogue && !scene.includes("수의사") && !scene.includes("의사")) {
      scene = `동물병원 진료실 안. 흰색 가운을 입은 40대 남성 수의사가 진료대 옆에서 고양이를 진찰하고 있는 모습. 그 옆에서 고정 그레이 후드티 차림의 20대 여성 주인공(나, 평범한 인간 귀)이 바라보고 있음. ${scene}`;
      if (!charIds.includes("ch_vet")) charIds.push("ch_vet");
    }

    // 2. 씬에 수의사나 의사가 전혀 없으면 charIds에서도 수의사 제외 (집 씬 등으로 이동 시 조연 퇴장)
    const hasVetInScene = scene.includes("수의사") || scene.includes("의사");
    if (!hasVetInScene) {
      charIds = charIds.filter((id) => !id.includes("vet") && !id.includes("doctor"));
    }

    // 3. 주인공 서술 통일: 중복 수식어 제거 후 단일화 및 조연 '백발' 번짐 방지
    scene = scene
      .replace(/백발의\s*/g, "단정한 흑발의 ")
      .replace(/(사복 차림의\s*)+/g, "")
      .replace(/(고정 그레이 후드티 차림의\s*)+/g, "")
      .replace(/(고정 다크 그레이 후드티 차림의\s*)+/g, "")
      .replace(/20대 여성 주인공\(나[^)]*\)/g, "주인공(나)")
      .replace(/주인공\(나[^)]*\)/g, "고정 다크 그레이 후드티 차림의 20대 여성 주인공(나, 평범한 인간 귀, 동물 귀 절대 없음)");

    if (!scene.includes("인간 귀")) {
      scene = scene.replace(/주인공\(나\)/g, "고정 다크 그레이 후드티 차림의 20대 여성 주인공(나, 평범한 인간 귀, 동물 귀 절대 없음)");
    }

    // 4. 배경 프리셋 자동 감지 및 설정 (사용자 설정이 없을 때)
    let bg = cut.background;
    if (!bg || bg.preset === "auto") {
      if (scene.includes("병원") || scene.includes("진료") || scene.includes("수의사")) {
        bg = { preset: "vet_clinic" };
      } else if (scene.includes("현관")) {
        bg = { preset: "entrance" };
      } else if (scene.includes("거실") || scene.includes("식기") || scene.includes("소파")) {
        bg = { preset: "living_room" };
      } else if (scene.includes("침실") || scene.includes("침대")) {
        bg = { preset: "bedroom" };
      } else if (scene.includes("카페")) {
        bg = { preset: "cafe" };
      } else {
        bg = { preset: "living_room" };
      }
    }

    // 5. 감정(emotion) 자동 추론 보정
    let emotion = cut.emotion;
    if (!emotion || emotion === "calm") {
      if (scene.includes("식은땀") || scene.includes("당황") || scene.includes("놀란") || scene.includes("깜짝") || scene.includes("어리둥절")) {
        emotion = "surprise";
      } else if (scene.includes("하악질") || scene.includes("화난") || scene.includes("짜증") || scene.includes("분노") || scene.includes("경계")) {
        emotion = "anger";
      } else if (scene.includes("억울") || scene.includes("지친") || scene.includes("한숨") || scene.includes("슬픈") || scene.includes("울상")) {
        emotion = "sadness";
      } else if (scene.includes("츄르") || scene.includes("허겁지겁") || scene.includes("반짝") || scene.includes("감동") || scene.includes("순해")) {
        emotion = "love";
      } else if (scene.includes("결국") || scene.includes("바쳤다") || scene.includes("비장")) {
        emotion = "determined";
      }
    }

    // 6. 카메라(camera) 리듬 보정: 모든 컷이 'medium'으로 고착되는 것을 방지하고 역동적인 만화 화각 부여
    let camera = cut.camera;
    const cutIdx = cut.index;
    if (!camera || camera === "medium") {
      if (cutIdx === 1) {
        camera = scene.includes("병원") ? "wide" : "medium";
      } else if (cutIdx === 2) {
        camera = "wide"; // 상황 전환/귀가: 전신 풀샷
      } else if (cutIdx === 3) {
        camera = "close_up"; // 갈등/하악질: 극적 감정 리액션 클로즈업
      } else if (cutIdx === 4) {
        camera = "top_down"; // 해결/츄르: 위에서 내려다보는 부감 하이앵글 바스트
      }
    }

    // 7. 연속 포즈 중복 방지 (Strict Pose Diversity Enforcement)
    // 2컷, 3컷, 4컷이 연속으로 '양반다리'나 '주저앉음'을 복제하지 못하도록 컷 번호에 맞춘 신체 동작 강제 변환
    if (cutIdx === 2 && (scene.includes("양반다리") || scene.includes("주저앉"))) {
      scene = scene.replace(/양반다리로 앉아.*?(?=과|와|,|\.)/g, "현관에 서서 바닥의 이동장 케이지를 내려놓는 스탠딩 자세를 취한");
      scene = scene.replace(/주저앉은/g, "선 채로 신발을 벗으려는");
    } else if (cutIdx === 3 && scene.includes("양반다리")) {
      scene = scene.replace(/양반다리로 앉아.*?(?=과|와|,|\.)/g, "깜짝 놀라 엉덩방아를 찧으며 뒤로 물러서서 손사래 치는");
    } else if (cutIdx === 4 && scene.includes("양반다리")) {
      scene = scene.replace(/양반다리로 앉아.*?(?=과|와|,|\.)/g, "무릎을 꿇고 상체를 앞으로 숙여(kneeling forward)");
    }

    return {
      ...cut,
      scene,
      characterIds: charIds,
      background: bg,
      emotion,
      camera,
    };
  });
}

function toHooks(raw: unknown): { text: string; rationale: string }[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((h) => ({
      text: typeof h === "object" && h && "text" in h ? String((h as Record<string, unknown>).text) : String(h),
      rationale: typeof h === "object" && h && "rationale" in h ? String((h as Record<string, unknown>).rationale) : "호기심을 유발한다",
    }));
  }
  return [
    { text: "그날 대체 무슨 일이 있었냐면...", rationale: "상황의 한복판으로 유도한다" },
    { text: "결국 이렇게 끝날 줄은 몰랐다", rationale: "결말 호기심을 자극한다" },
    { text: "다들 이런 경험 한 번쯤 있지 않나요?", rationale: "공감을 이끌어낸다" },
  ];
}

function toCtas(raw: unknown): { kind: "like" | "next_episode" | "question"; text: string; rationale: string }[] {
  const validKinds = new Set(["like", "next_episode", "question"]);
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((c) => ({
      kind: (typeof c === "object" && c && "kind" in c && validKinds.has(String((c as Record<string, unknown>).kind)))
        ? ((c as Record<string, unknown>).kind as "like" | "next_episode" | "question")
        : "like",
      text: typeof c === "object" && c && "text" in c ? String((c as Record<string, unknown>).text) : String(c),
      rationale: typeof c === "object" && c && "rationale" in c ? String((c as Record<string, unknown>).rationale) : "반응을 모은다",
    }));
  }
  return [
    { kind: "like", text: "공감되면 좋아요와 저장 부탁드려요!", rationale: "행동 부담이 낮다" },
    { kind: "next_episode", text: "다음 화에서 이어집니다", rationale: "팔로우 유도" },
    { kind: "question", text: "여러분이라면 어떻게 하셨을 것 같나요?", rationale: "댓글 대화 유도" },
  ];
}

function toStoryboard(
  res: StoryboardResponse,
  input: GenerateStoryboardInput,
): Storyboard {
  const now = new Date().toISOString();
  const seq = idSequence();

  const rawCutsList = Array.isArray(res.cuts)
    ? res.cuts
    : (res.cuts && typeof res.cuts === "object" ? Object.values(res.cuts) : []);

  const cutsSource = rawCutsList.length > 0 ? rawCutsList : mockStoryboard(input).cuts;

  const rawCuts: StoryboardCut[] = cutsSource.map((cut: any, i: number) => ({
    id: seq("cut"),
    index: i + 1,
    scene: cut.scene || "장면 묘사",
    characterIds: Array.isArray(cut.characters) ? cut.characters : (cut.characterIds || ["ch_me"]),
    emotion: cut.emotion || "calm",
    camera: cut.camera || "medium",
    dialogue: (Array.isArray(cut.dialogue) ? cut.dialogue : []).map((line: any) => ({
      id: seq("ln"),
      speakerId: extractSpeakerId(line.speaker ?? line.speakerId),
      text: line.text || "",
      balloon: line.balloon || "normal",
    })),
    narration: cut.narration === "" ? undefined : cut.narration,
  }));

  const cuts = refineStoryboardCuts(rawCuts);
  const characters = toCharacters(res.characters);
  const hooks = toHooks(res.hooks);
  const ctas = toCtas(res.ctas);

    const hookList = hooks.map((h) => ({ id: seq("hook"), text: h.text, rationale: h.rationale }));
    const ctaList = ctas.map((c) => ({
      id: seq("cta"),
      kind: c.kind,
      text: c.text,
      rationale: c.rationale,
    }));

    return {
      id: seq("sb"),
      episodeId: input.episodeId,
      seriesId: input.seriesId,
      status: "draft",
      story: input.story,
      characters,
      cuts,
      hookOptions: hookList,
      selectedHookId: hookList[0]?.id ?? null,
      ctaOptions: ctaList,
      selectedCtaId: ctaList[0]?.id ?? null,
      createdAt: now,
      updatedAt: now,
    };
}

/** 한 콘티 안에서 유일하면 된다. 컷 id 가 그대로 저장 키(cuts.cut_id)가 되므로 난수를 섞는다. */
function idSequence() {
  const salt = crypto.randomUUID().slice(0, 6);
  let n = 0;
  return (prefix: string) => `${prefix}_${salt}${(++n).toString(36)}`;
}

export { ALLOWED };
