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
import {
  EMOTION_LABEL,
  type CutEmotion,
  type Storyboard,
  type StoryboardCut,
  type BackgroundPreset,
  type CutBackground,
} from "../types/storyboard";
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
  return [{ key: "ch_me", name: "나" }];
}

function extractSpeakerId(speaker: unknown): string | null {
  if (!speaker || speaker === "") return null;
  if (typeof speaker === "string") {
    if (speaker.includes("object Object")) return "ch_me";
    return speaker.trim();
  }
  if (typeof speaker === "object") {
    const obj = speaker as Record<string, unknown>;
    if (typeof obj.key === "string" && !obj.key.includes("object Object")) return obj.key.trim();
    if (typeof obj.name === "string" && !obj.name.includes("object Object")) return obj.name.trim();
    const firstKey = Object.keys(obj)[0];
    if (firstKey) return firstKey.trim();
  }
  return "ch_me";
}

function normalizeSpeakerId(
  rawSpeaker: unknown,
  characters: { key: string; name: string }[],
  registerUnknown = false,
): string | null {
  const extracted = extractSpeakerId(rawSpeaker);
  if (
    !extracted ||
    extracted === "나레이션" ||
    extracted === "화자없음" ||
    extracted === "화자 없음" ||
    extracted.toLowerCase() === "narration" ||
    extracted.toLowerCase() === "none"
  ) {
    return null;
  }

  // 1. 이미 존재하는 key 와 일치하는 경우
  const matchByKey = characters.find((c) => c.key === extracted);
  if (matchByKey) return matchByKey.key;

  // 2. '나' 또는 '주인공'인 경우 항상 ch_me
  if (extracted === "나" || extracted === "주인공" || extracted.toLowerCase() === "me") {
    return "ch_me";
  }

  // 3. 캐릭터 이름과 일치하거나 부분 포함되는 경우
  const matchByName = characters.find(
    (c) => c.name === extracted || c.name.includes(extracted) || extracted.includes(c.name),
  );
  if (matchByName) return matchByName.key;

  // 4. 새로운 인물일 경우: 사연에 없던 인물이면 날조를 방지하기 위해 '나' 또는 효과음으로 안전 귀속
  if (registerUnknown) {
    if (extracted.includes("효과음") || extracted.includes("독백") || extracted.includes("생각") || extracted.includes("소리")) {
      return null;
    }
    return characters[0]?.key ?? "ch_me";
  }

  return characters[0]?.key ?? "ch_me";
}

function refineStoryboardCuts(cuts: StoryboardCut[]): StoryboardCut[] {
  const refined = cuts.map((cut) => {
    let scene = cut.scene;
    let charIds = (Array.isArray(cut.characterIds) ? cut.characterIds : [])
      .map((c: any) => (typeof c === "string" ? c : (c?.key || c?.id || String(c))));

    // 0. 대사에 참여한 화자가 컷의 characterIds에 빠져있으면 자동 보강
    for (const d of cut.dialogue) {
      if (d.speakerId && !charIds.includes(d.speakerId)) {
        charIds.push(d.speakerId);
      }
    }
    if (charIds.length === 0) {
      charIds.push("ch_me");
    }

    // 1. 대사에 수의사나 병원 관련 대사가 있는데 씬에 의사가 빠진 경우 명시 추가
    const hasVetDialogue = cut.dialogue.some(
      (d) =>
        (typeof d.speakerId === "string" && (d.speakerId.includes("vet") || d.speakerId.includes("doctor") || d.speakerId.includes("수의사"))) ||
        d.text.includes("진료")
    );
    if (hasVetDialogue && !scene.includes("수의사") && !scene.includes("의사")) {
      const petType = cut.dialogue.some((d) => d.text.includes("고양이") || d.text.includes("냥이"))
        ? "고양이"
        : cut.dialogue.some((d) => d.text.includes("강아지") || d.text.includes("댕댕이"))
          ? "강아지"
          : "반려동물";
      scene = `동물병원 진료실 안. 흰색 가운을 입은 40대 남성 수의사가 진료대 옆에서 ${petType}를 진찰하고 있는 모습. 그 옆에서 지켜보는 주인공. ${scene}`;
      if (!charIds.includes("ch_vet")) charIds.push("ch_vet");
    }

    // 2. 씬에 수의사나 의사가 전혀 없으면 charIds에서도 수의사 제외 (집 씬 등으로 이동 시 조연 퇴장)
    const hasVetInScene = scene.includes("수의사") || scene.includes("의사");
    if (!hasVetInScene) {
      charIds = charIds.filter((id) => typeof id === "string" && !id.includes("vet") && !id.includes("doctor"));
    }

    // 3. 조연 '백발' 번짐 방지 및 중복 수식어 정리
    scene = scene
      .replace(/백발의\s*/g, "단정한 흑발의 ")
      .replace(/(사복 차림의\s*)+/g, "")
      .replace(/(고정 그레이 후드티 차림의\s*)+/g, "")
      .replace(/(고정 다크 그레이 후드티 차림의\s*)+/g, "");

    // 4. 배경 프리셋 자동 감지 및 설정 (사용자 설정이 없을 때)
    let bg = cut.background;
    if (!bg || bg.preset === "auto") {
      const targetText = `${scene} ${bg?.customName ?? ""}`;
      let detectedPreset: BackgroundPreset | null = null;
      let defaultName = bg?.customName;

      if (targetText.includes("병원") || targetText.includes("진료") || targetText.includes("수의사") || targetText.includes("클리닉")) {
        detectedPreset = "vet_clinic";
        defaultName = defaultName || "동물병원";
      } else if (targetText.includes("편의점") || targetText.includes("마트") || targetText.includes("슈퍼")) {
        detectedPreset = "convenience_store";
        defaultName = defaultName || "편의점/마트";
      } else if (targetText.includes("카페") || targetText.includes("커피") || targetText.includes("베이커리")) {
        detectedPreset = "cafe";
        defaultName = defaultName || "카페";
      } else if (
        targetText.includes("식당") ||
        targetText.includes("술집") ||
        targetText.includes("포차") ||
        targetText.includes("포장마차") ||
        targetText.includes("고깃집") ||
        targetText.includes("밥집") ||
        targetText.includes("주점") ||
        targetText.includes("호프")
      ) {
        detectedPreset = "restaurant";
        defaultName = defaultName || "식당/술집";
      } else if (
        targetText.includes("공원") ||
        targetText.includes("산책") ||
        targetText.includes("잔디") ||
        targetText.includes("놀이터") ||
        targetText.includes("벤치")
      ) {
        detectedPreset = "park";
        defaultName = defaultName || "공원/산책로";
      } else if (
        targetText.includes("길거리") ||
        targetText.includes("골목") ||
        targetText.includes("도로") ||
        targetText.includes("횡단보도") ||
        targetText.includes("야외") ||
        targetText.includes("거리") ||
        targetText.includes("밤길") ||
        targetText.includes("인도")
      ) {
        detectedPreset = "street";
        defaultName = defaultName || "길거리/야외";
      } else if (
        targetText.includes("회사") ||
        targetText.includes("사무실") ||
        targetText.includes("회의") ||
        targetText.includes("팀장") ||
        targetText.includes("출근") ||
        targetText.includes("퇴근") ||
        targetText.includes("부장") ||
        targetText.includes("오피스") ||
        targetText.includes("엘리베이터")
      ) {
        detectedPreset = "office";
        defaultName = defaultName || "사무실";
      } else if (targetText.includes("현관") || targetText.includes("신발장") || targetText.includes("문 앞")) {
        detectedPreset = "entrance";
        defaultName = defaultName || "현관";
      } else if (
        targetText.includes("침실") ||
        targetText.includes("침대") ||
        targetText.includes("내 방") ||
        targetText.includes("방 안") ||
        targetText.includes("자취방") ||
        targetText.includes("원룸")
      ) {
        detectedPreset = "bedroom";
        defaultName = defaultName || "침실/방";
      } else if (
        targetText.includes("거실") ||
        targetText.includes("식기") ||
        targetText.includes("소파") ||
        targetText.includes("부엌") ||
        targetText.includes("주방") ||
        targetText.includes("식탁")
      ) {
        detectedPreset = "living_room";
        defaultName = defaultName || "거실";
      }

      if (detectedPreset) {
        bg = { preset: detectedPreset, customName: defaultName };
      } else if (bg?.customName && bg.customName.trim()) {
        bg = { preset: "auto", customName: bg.customName.trim() };
      } else {
        // Fallback: 풍부한 일상 실내 배경 (절대 단색 solid_color 로 강등하지 않음)
        bg = { preset: "living_room", customName: "일상 실내 공간" };
      }
    }

    // 5. 감정(emotion) 자동 추론 보정
    let emotion = cut.emotion;
    if (!emotion || emotion === "calm") {
      if (scene.includes("식은땀") || scene.includes("당황") || scene.includes("놀란") || scene.includes("깜짝") || scene.includes("어리둥절")) {
        emotion = "surprised";
      } else if (scene.includes("하악질") || scene.includes("화난") || scene.includes("짜증") || scene.includes("분노") || scene.includes("경계")) {
        emotion = "angry";
      } else if (scene.includes("억울") || scene.includes("지친") || scene.includes("한숨") || scene.includes("슬픈") || scene.includes("울상")) {
        emotion = "sad";
      } else if (scene.includes("츄르") || scene.includes("허겁지겁") || scene.includes("반짝") || scene.includes("감동") || scene.includes("순해")) {
        emotion = "joy";
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
      scene = scene.replace(/주저앉은/g, "선 채로 뒤를 돌아보는");
    } else if (cutIdx === 3 && scene.includes("양반다리")) {
      scene = scene.replace(/양반다리로 앉아.*?(?=과|와|,|\.)/g, "깜짝 놀라 뒤로 물러서서 손사래 치는");
    } else if (cutIdx === 4 && scene.includes("양반다리")) {
      scene = scene.replace(/양반다리로 앉아.*?(?=과|와|,|\.)/g, "상체를 앞으로 숙이며");
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

  // 8. 나레이션 절제 보정 (Narration Sparsity Enforcement)
  // 인스타툰에서는 모든 컷에 나레이션이 들어가면 화면이 조잡해지고 가독성이 떨어짐.
  // 4~10컷 기준 전체 중 최대 1~2개 컷(주로 1컷 착수 또는 마지막 컷 여운/수습)에만 한정.
  const totalCuts = refined.length;

  // 8-1. 빈 문자열 또는 공백, "없음" 등 무의미한 나레이션 정리
  for (const c of refined) {
    if (c.narration) {
      const trimmed = c.narration.trim();
      if (!trimmed || trimmed === "없음" || trimmed === "None" || trimmed === "null") {
        c.narration = undefined;
      } else {
        c.narration = trimmed;
      }
    }
  }

  // 8-2. 중간 컷(1컷과 마지막 컷 제외) 중 대사가 있는 컷은 나레이션 제거
  for (const c of refined) {
    const isFirst = c.index === 1;
    const isLast = c.index === totalCuts;
    const hasDialogue = Array.isArray(c.dialogue) && c.dialogue.length > 0;
    if (!isFirst && !isLast && hasDialogue) {
      c.narration = undefined;
    }
  }

  // 8-3. 나레이션이 들어간 컷이 2개를 초과하면, 1컷과 마지막 컷 우선 남기고 나머지 중간 컷 나레이션 제거
  let cutsWithNarration = refined.filter((c) => c.narration != null);
  if (cutsWithNarration.length > 2) {
    for (const c of refined) {
      const isFirst = c.index === 1;
      const isLast = c.index === totalCuts;
      if (!isFirst && !isLast) {
        c.narration = undefined;
      }
    }
  }

  // 8-4. 만약 여전히 2개 초과라면, 최대 2개만 남기고 나머지는 정리
  cutsWithNarration = refined.filter((c) => c.narration != null);
  if (cutsWithNarration.length > 2) {
    let count = 0;
    for (const c of refined) {
      if (c.narration != null) {
        count++;
        if (count > 2) {
          c.narration = undefined;
        }
      }
    }
  }

  // 8-5. 유효한 나레이션을 dialogue 내의 화자 없는 나레이션 라인으로 통합
  for (const c of refined) {
    if (c.narration && !c.dialogue.some((d) => !d.speakerId || d.balloon === "narration_box")) {
      c.dialogue.unshift({
        id: `ln_narr_${crypto.randomUUID().slice(0, 8)}`,
        speakerId: null,
        text: c.narration,
        balloon: "narration_box",
      });
      c.narration = undefined;
    }
  }

  return refined;
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
  const characters = toCharacters(res.characters);

  const rawCuts: StoryboardCut[] = cutsSource.map((cut: any, i: number) => {
    const rawScene =
      cut.scene ||
      cut.scene_description ||
      cut.description ||
      cut.visual ||
      cut.image_prompt ||
      cut.prompt ||
      cut.action;

    let sceneText =
      typeof rawScene === "string" && rawScene.trim().length > 0 && rawScene.trim() !== "장면 묘사"
        ? rawScene.trim()
        : "";

    if (!sceneText) {
      const lineTexts = (Array.isArray(cut.dialogue) ? cut.dialogue : [])
        .map((l: any) => (typeof l === "string" ? l : l?.text))
        .filter(Boolean)
        .join(" ");
      const emotionKor = EMOTION_LABEL[cut.emotion as CutEmotion] || "생생한";
      const beat = (input.story || "").slice(0, 35);
      const protagonistName = characters[0]?.name || "주인공";
      sceneText = lineTexts
        ? `${protagonistName}이(가) ${emotionKor} 표정으로 상황에 반응하는 모습. 대화 상황: "${lineTexts.slice(0, 30)}"`
        : `${beat}의 상황. ${protagonistName}이(가) ${emotionKor} 표정으로 서 있는 장면.`;
    }

    const rawLocation =
      typeof cut.location === "string" && cut.location.trim().length > 0 && cut.location.trim() !== "없음"
        ? cut.location.trim()
        : typeof cut.background === "string" && cut.background.trim().length > 0
          ? cut.background.trim()
          : (cut.background && typeof cut.background === "object" && typeof cut.background.customName === "string"
            ? cut.background.customName.trim()
            : undefined);

    let initialBg: CutBackground | undefined = undefined;
    if (cut.background && typeof cut.background === "object" && "preset" in cut.background) {
      initialBg = cut.background;
    } else if (rawLocation) {
      initialBg = { preset: "auto", customName: rawLocation };
    }

    return {
      id: seq("cut"),
      index: i + 1,
      scene: sceneText,
      characterIds: (Array.isArray(cut.characters) ? cut.characters : (cut.characterIds || ["ch_me"]))
        .map((c: any) => (typeof c === "string" ? c : (c?.key || c?.id || String(c)))),
      emotion: cut.emotion || "calm",
      camera: cut.camera || "medium",
      background: initialBg,
      dialogue: (Array.isArray(cut.dialogue) ? cut.dialogue : []).map((line: any) => {
        const spId = normalizeSpeakerId(line.speaker ?? line.speakerId, characters);
        return {
          id: seq("ln"),
          speakerId: spId,
          text: line.text || "",
          balloon: (!spId && (!line.balloon || line.balloon === "normal")) ? "narration_box" : (line.balloon || "normal"),
          position: line.position,
        };
      }),
      narration:
        typeof cut.narration === "string" &&
        cut.narration.trim().length > 0 &&
        cut.narration.trim() !== "없음"
          ? cut.narration.trim()
          : undefined,
    };
  });

  const cuts = refineStoryboardCuts(rawCuts);
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
