/**
 * 웹툰 화풍 및 캐릭터 일관성 프롬프트 하네스 (Codex Invariants & Scaffolding)
 *
 * 코덱스(Codex)의 이미지 생성 하네스 원칙(Scaffolding, Labeled Input Roles,
 * Strict Invariants Enforcement, Specificity Normalization)을 바탕으로,
 * 회차 및 컷 간 화풍·캐릭터·선화 표류(Drift)를 차단하는 구조화된 프롬프트를 생성합니다.
 */

import type { CutEditIntent } from "@/contracts/generation";

export interface StructuredPromptParams {
  /** 컷 인덱스 (1부터 시작) */
  cutIndex?: number;
  /** 한국어 원본 콘티 컷 지문 */
  cutText: string;
  /** 영문으로 번역/정제된 시각적 장면 묘사 */
  visualScene: string;
  /** 시리즈 스타일 프리셋 (심플 라인, 파스텔, 굵은 선 등) */
  stylePreset?: string;
  /** 시리즈/캐릭터 에셋에서 등록된 인물 외모 특징 */
  characterAppearance?: string;
  /** 강제 지정할 화각 (선택) */
  cameraOverride?: string;
  /** 강제 지정할 배경 (선택) */
  environmentOverride?: string;
  /** 한 컷 재생성 인텐트 (새 구도, 표정 변경, 배경 변경 등) */
  intent?: CutEditIntent;
  /** 사용자 추가 입력 프롬프트 / 연출 요청 */
  customRequest?: string;
}

export interface StructuredPromptResult {
  /** 긍정 프롬프트 (스캐폴딩 및 불변식 구조화) */
  prompt: string;
  /** 부정 프롬프트 (스타일 이탈 및 환각 방지 제약) */
  negativePrompt: string;
  /** 카메라 화각 */
  cameraFraming: string;
  /** 배경 프롬프트 */
  environmentPrompt: string;
  /** 감정 묘사 큐 */
  emotionCue: string;
  /** 소품 상호작용 큐 */
  propInteractionCue: string;
  /** 단색 배경 여부 */
  isSolidColor: boolean;
  /** 수의사/의사 등 조연 등장 여부 */
  hasVetInCut: boolean;
  /** 고양이 등장 여부 */
  hasCatInCut: boolean;
}

/**
 * 화풍별 일러스트 앵커 프롬프트 (Style Invariant Anchor)
 */
export function resolveStyleAnchor(style?: string): string {
  switch (style) {
    case "파스텔":
    case "pastel":
      return "soft pastel flat cel colors, uniform 1.5px smooth dark-grey ink outlines, warm cozy Korean slice-of-life manhwa style, flat 2D coloring, zero 3D rendering, zero gradients";
    case "굵은 선":
    case "bold_line":
      return "bold crisp black ink outlines with uniform 2.5px stroke weight, punchy vibrant flat solid cel shading, graphic novel modern comic manhwa style, zero gradients, zero 3D rendering";
    case "명랑 코믹":
    case "cheerful_comic":
      return "vibrant cheerful comedy webtoon style, dynamic expressive comic ink outlines, bright bouncy pop solid colors, lighthearted Korean comedy webtoon manhwa aesthetic, flat cel shading";
    case "감성 색연필":
    case "colored_pencil":
      return "warm soft textured pencil contour outlines, gentle watercolor flat fills, cozy aesthetic slice-of-life essay webtoon manhwa style, clean comic aesthetic";
    case "모던 K-웹툰":
    case "modern_manhwa":
      return "sleek modern Korean romance drama webtoon manhwa style, refined delicate 1.3px ink contour lineart, trendy stylish cel shading, crisp shadow edges, aesthetic character rendering";
    case "심플 라인":
    case "simple_line":
      return "clean black ink contour lineart with uniform 1.8px stroke weight, flat solid cel shading with crisp hard shadow boundaries, zero gradients, zero 3D rendering, modern Korean slice-of-life webtoon manhwa style";
    default:
      if (style && style.trim().length > 0) {
        return `custom artwork style (${style}), artistic comic ink contour lineart, distinctive consistent 2D manhwa illustration aesthetic, flat solid cel shading, zero 3D rendering`;
      }
      return "clean black ink contour lineart with uniform 1.8px stroke weight, flat solid cel shading with crisp hard shadow boundaries, zero gradients, zero 3D rendering, modern Korean slice-of-life webtoon manhwa style";
  }
}

/**
 * 카메라 화각 및 앵글 판별 (Framing Diversity)
 */
export function detectCameraFraming(cutText: string): string {
  if (cutText.includes("익스트림 클로즈업") || cutText.includes("extreme_close_up")) {
    return "Intense dramatic extreme close-up shot focused tightly on expressive comic facial reaction, wide eyes, and trembling mouth";
  }
  if (cutText.includes("클로즈업") || cutText.includes("close_up")) {
    return "Close-up portrait shot (upper chest and expressive head), dynamic comic reaction framing";
  }
  if (cutText.includes("부감") || cutText.includes("top_down") || cutText.includes("하이앵글")) {
    return "High-angle shot (looking down from above), overhead comic perspective showing character's interaction with the cat and props on the floor";
  }
  if (cutText.includes("오버 숄더") || cutText.includes("over_shoulder")) {
    return "Over-the-shoulder shot framing one character from behind looking across at the other character's dramatic reaction";
  }
  if (cutText.includes("익스트림 롱") || cutText.includes("extreme_wide")) {
    return "Wide establishing shot showing the entire room environment and full standing character figures";
  }
  if (cutText.includes("롱") || cutText.includes("wide") || cutText.includes("풀샷")) {
    return "Full-length body shot showing characters from head to shoes with architectural background depth";
  }
  if (cutText.includes("로우앵글") || cutText.includes("low_angle")) {
    return "Dynamic low-angle shot looking up, creating comic drama and tension";
  }
  return "Dynamic medium shot (waist up), eye-level angle";
}

/**
 * 배경 환경 묘사 판별 (Environment & Background Anchor)
 */
export function detectEnvironment(cutText: string): { prompt: string; isSolidColor: boolean } {
  const isExplicitSolid =
    cutText.includes("배경: 단색") ||
    cutText.includes("배경: solid_color") ||
    /배경:\s*#[0-9a-fA-F]{6}/.test(cutText);

  if (isExplicitSolid) {
    const hexMatch = cutText.match(/#[0-9a-fA-F]{6}/);
    const colorHex = hexMatch ? hexMatch[0] : "#FFF9F0";
    return {
      prompt: `[Environment]: Solid flat pastel background (${colorHex}), minimalist clean comic colored backdrop, zero clutter, clean graphic design negative space, studio color backdrop.`,
      isSolidColor: true,
    };
  }

  if (cutText.includes("동물병원") || cutText.includes("진료실") || cutText.includes("vet_clinic")) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated detailed veterinary clinic interior setting with architectural depth. Stainless steel examination counter, background shelves stocked with pet medicines and veterinary supplies, medical posters on the wall, clinic window and consultation desk, overhead clinical ambient lighting, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }
  if (cutText.includes("현관") || cutText.includes("entrance")) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated modern Korean apartment entrance hallway setting with architectural depth. Digital door lock front door, shoe rack with shoes, clean tiled entryway floor, baseboards, hallway wall molding, ceiling entrance lighting, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }
  if (
    cutText.includes("침실") ||
    cutText.includes("침대") ||
    cutText.includes("내 방") ||
    cutText.includes("자취방") ||
    cutText.includes("원룸") ||
    cutText.includes("bedroom")
  ) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated cozy Korean bedroom interior setting with architectural depth. Neat bed with duvet, wooden nightstand, desk, bookshelf, curtains with soft daylight, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }
  if (
    cutText.includes("편의점") ||
    cutText.includes("마트") ||
    cutText.includes("슈퍼") ||
    cutText.includes("convenience_store")
  ) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated Korean convenience store setting with architectural depth. Bright fluorescent ceiling lights, snack and beverage shelves, glass door drink refrigerators in the background, checkout counter, linoleum floor, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }
  if (
    cutText.includes("식당") ||
    cutText.includes("술집") ||
    cutText.includes("포차") ||
    cutText.includes("포장마차") ||
    cutText.includes("음식점") ||
    cutText.includes("고깃집") ||
    cutText.includes("밥집") ||
    cutText.includes("주점") ||
    cutText.includes("호프") ||
    cutText.includes("restaurant")
  ) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated cozy Korean restaurant or pub interior setting with architectural depth. Dining tables with side dishes, dining chairs, warm ambient lighting, restaurant wall menus and posters in background, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }
  if (
    cutText.includes("공원") ||
    cutText.includes("산책") ||
    cutText.includes("잔디") ||
    cutText.includes("놀이터") ||
    cutText.includes("park")
  ) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated scenic outdoor park setting with architectural depth. Lush green trees, paved walking path, wooden park benches, manicured grass, open sky with natural daylight, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }
  if (
    cutText.includes("길거리") ||
    cutText.includes("골목") ||
    cutText.includes("도로") ||
    cutText.includes("횡단보도") ||
    cutText.includes("야외") ||
    cutText.includes("거리") ||
    cutText.includes("밤길") ||
    cutText.includes("인도") ||
    cutText.includes("street")
  ) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated Korean outdoor city street or neighborhood alleyway setting with architectural depth. Asphalt pavement, pedestrian sidewalk, streetlamps, storefront facades and brick residential walls in background, realistic ambient day/evening lighting, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }
  if (cutText.includes("카페") || cutText.includes("cafe")) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated cozy aesthetic cafe interior setting with architectural depth. Wooden tables, cafe counter in background, warm pendant lights, large glass cafe window with city view, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }
  if (cutText.includes("사무실") || cutText.includes("회사") || cutText.includes("office")) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated modern corporate office interior setting with architectural depth. Office desks, monitors, office partition, water cooler in background, professional interior lighting, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }

  const customBgMatch = cutText.match(/배경:\s*([^/]+)/);
  const customBg = customBgMatch ? customBgMatch[1].trim() : "";
  if (customBg && !customBg.includes("단색") && !customBg.includes("거실")) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated detailed ${customBg} setting with architectural depth and environmental props, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }

  if (cutText.includes("거실") || cutText.includes("소파") || cutText.includes("living_room")) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated cozy modern Korean apartment living room interior setting with architectural depth. Warm light wooden flooring with subtle grain, fabric sofa and cushions in the background, low coffee table, baseboards, window blinds with ambient daylight, lived-in interior props, strictly NO empty background, NO plain white void.`,
      isSolidColor: false,
    };
  }

  return {
    prompt: `[Environment & Setting]: Fully illustrated clean modern interior indoor setting with subtle architectural depth, neat walls, natural flooring, environmental props fitting the scene, strictly NO empty background, NO plain white void.`,
    isSolidColor: false,
  };
}

/**
 * 극적 표정 및 만화적 리액션 큐 (Emotion Invariant Anchor)
 */
export function detectEmotionCue(cutText: string, hasCat: boolean = false): string {
  if (
    cutText.includes("놀람") ||
    cutText.includes("surprise") ||
    cutText.includes("당황") ||
    cutText.includes("식은땀") ||
    cutText.includes("경악")
  ) {
    return "[Facial Expression & Comical Mood]: Highly exaggerated comic shock expression: wide panicked manga eyes, big visible nervous cold sweat drop on temple, comical open screaming/gasping mouth, flustered flushed cheeks.";
  }
  if (
    cutText.includes("분노") ||
    cutText.includes("anger") ||
    cutText.includes("화난") ||
    cutText.includes("하악질") ||
    cutText.includes("짜증")
  ) {
    if (hasCat || cutText.includes("하악질")) {
      return "[Facial Expression & Comical Mood]: Comical angry furrowed eyebrows, intense pouty scowl; cat hissing fiercely with bared sharp teeth, flattened airplane ears, bristled arched back.";
    }
    return "[Facial Expression & Comical Mood]: Comical angry furrowed eyebrows, intense pouty scowl, sharp comical reaction, dramatic comic anger lines.";
  }
  if (
    cutText.includes("슬픔") ||
    cutText.includes("sadness") ||
    cutText.includes("억울") ||
    cutText.includes("지친") ||
    cutText.includes("한숨")
  ) {
    return "[Facial Expression & Comical Mood]: Comical wronged despair, trembling watery eyes, downturned pouty mouth, completely exhausted slump in comical misery.";
  }
  if (
    cutText.includes("사랑") ||
    cutText.includes("love") ||
    cutText.includes("기쁨") ||
    cutText.includes("joy") ||
    cutText.includes("츄르") ||
    cutText.includes("간절")
  ) {
    if (hasCat || cutText.includes("츄르")) {
      return "[Facial Expression & Comical Mood]: Pleading gentle comic smile with sweat drops, desperate comical appeasing expression holding treats; cat with huge sparkling starry eyes eagerly staring at treats.";
    }
    return "[Facial Expression & Comical Mood]: Bright beaming joyful comic smile, happy sparkling starry comic eyes, cheerful celebratory comic expression!";
  }
  return "[Facial Expression & Comical Mood]: Highly expressive dynamic Korean webtoon facial reaction fitting the active comic scene.";
}

/**
 * 소품 상호작용 큐 (Props Interaction Anchor)
 */
export function detectPropInteractionCue(cutText: string, hasCat: boolean = false): string {
  if (cutText.includes("츄르") || (hasCat && (cutText.includes("간식") || cutText.includes("puree")))) {
    return "[Props & Hands Interaction]: Main character's hands are actively holding and squeezing a slender red tube sachet of cat puree treat, with creamy treat paste protruding from the tip directly toward the cat's mouth.";
  }
  if (cutText.includes("카드") || cutText.includes("결제")) {
    return "[Props & Hands Interaction]: Main character is holding and extending a credit card in hand towards the counter.";
  }
  if (cutText.includes("이동장") || cutText.includes("캐리어")) {
    return "[Props & Scene Props]: A plastic pet travel carrier box rests open on the floor nearby.";
  }
  return "";
}

/**
 * 코덱스 하네스 스타일의 웹툰 구조화 프롬프트 빌더 (Build Structured Webtoon Prompt)
 */
export function buildStructuredWebtoonPrompt(params: StructuredPromptParams): StructuredPromptResult {
  const { cutText, visualScene, stylePreset, characterAppearance, cameraOverride, environmentOverride } = params;

  const styleAnchor = resolveStyleAnchor(stylePreset);

  // 소재(캐릭터, 동물, 배경, 소품) 레퍼런스 이미지 생성 전용 프롬프트 처리
  const isAssetGen = cutText.includes("[ASSET TYPE]:") || cutText.includes("asset_gen");
  if (isAssetGen) {
    const isProp = cutText.includes("[ASSET TYPE]: prop") || cutText.includes("소품");
    const isLocation = cutText.includes("[ASSET TYPE]: location") || cutText.includes("장소") || cutText.includes("배경");
    const isAnimal = cutText.includes("[ASSET TYPE]: animal") || cutText.includes("동물");

    const assetSubjectDirective = isProp
      ? `[ASSET SUBJECT - PROP]: Isolated prop item illustration on clean minimalist studio neutral background. Crisp uniform lineart, flat solid cel shading, zero gradients. Strictly NO human, NO hands holding it, NO people in the image.`
      : isLocation
      ? `[ASSET SUBJECT - LOCATION]: Architectural background environment concept artwork of the space with rich spatial depth, neat interior elements, and consistent perspective. Strictly NO people, NO characters, empty clean space.`
      : isAnimal
      ? `[ASSET SUBJECT - ANIMAL]: Isolated animal character illustration on clean neutral background. Natural quadruped animal anatomy, expressive webtoon eyes, natural paws and fur, strictly NO human clothes on animal, strictly NO people.`
      : `[ASSET SUBJECT - CHARACTER]: Full-body character reference illustration on clean neutral background. Natural 6.8 heads adult Korean webtoon proportions, standing pose, clear recognizable facial features and hairstyle, signature casual outfit, strictly NO other characters.`;

    const promptLines = [
      `[USE CASE & MEDIUM]: Korean 2D webtoon asset reference illustration, clean animation model sheet art.`,
      `[ART DIRECTION & STYLE]: ${styleAnchor}.`,
      `[STRICT RENDERING CONSTRAINTS]: 100% 2D flat digital graphic novel illustration, uniform clean 1.8px black contour lineart, flat solid cel shading fills with zero smooth airbrush gradients, zero 3D rendering, zero photorealism.`,
      `[SPECIFICATION & DETAILS]: ${visualScene}.`,
      assetSubjectDirective,
      `[LIGHTING & BACKGROUND]: Soft warm ambient daylight, solid clean minimalist neutral background (#FAFAFA), textless composition.`,
      `[OUTPUT REQUIREMENTS]: Pure visual asset artwork, textless composition, clean drawing, strictly identical style and features as specified.`,
    ];

    const negativePrompt = [
      "text, words, letters, typography, alphabet, speech bubble, thought bubble, talk bubble, dialogue box, watermark, signature, logo, border, multiple panels",
      "photorealistic, 3d render, cgi, octane render, unreal engine, volumetric lighting, airbrushed skin, skin pores, realistic photography, oil painting",
      "semi-realistic, 3d model, blurry lines, messy lines",
      isProp ? "human, person, hand, fingers, face, holding, body, character" : "",
      isLocation ? "human, person, people, character, crowd, walking person" : "",
      isAnimal ? "human, human clothes, hoodie on animal, mutated paws, extra limbs" : "",
      !isProp && !isLocation && !isAnimal ? "extra people, background crowd, second person, chibi, SD, animal ears" : "",
    ].filter(Boolean).join(", ");

    return {
      prompt: promptLines.join("\n"),
      negativePrompt,
      cameraFraming: isLocation ? "Wide establishing angle" : "Centered asset view",
      environmentPrompt: isLocation ? "Fully illustrated environment" : "Clean neutral solid background",
      emotionCue: "",
      propInteractionCue: "",
      isSolidColor: !isLocation,
      hasVetInCut: false,
      hasCatInCut: isAnimal && cutText.includes("고양이"),
    };
  }

  const cameraFraming = cameraOverride || detectCameraFraming(cutText);
  const envResult = detectEnvironment(cutText);
  const environmentPrompt = environmentOverride || envResult.prompt;
  const isSolidColor = envResult.isSolidColor;

  const hasCatInCut = cutText.includes("고양이") || cutText.includes("냥이") || cutText.includes("cat") || cutText.includes("하악질") || cutText.includes("츄르");
  const emotionCue = detectEmotionCue(cutText, hasCatInCut);
  const propInteractionCue = detectPropInteractionCue(cutText, hasCatInCut);

  const hasVetInCut = cutText.includes("수의사") || cutText.includes("의사");
  const hasDogInCut = cutText.includes("강아지") || cutText.includes("개") || cutText.includes("dog") || cutText.includes("포메");
  const hasMultipleHumans =
    cutText.includes("둘") ||
    cutText.includes("함께") ||
    cutText.includes("와 ") ||
    cutText.includes("과 ") ||
    cutText.includes("동료") ||
    cutText.includes("상사") ||
    cutText.includes("부장") ||
    cutText.includes("친구") ||
    cutText.includes("팀장");

  const humanPresenceRule = hasMultipleHumans
    ? `[Human Characters in this panel]: Only the specific characters mentioned in the scene. Strictly NO unexpected extra bystanders, NO random background crowd.`
    : `[Human Characters in this panel]: Exactly ONE human: ONLY the main protagonist. Strictly NO other people, NO unexpected second person, NO random bystanders in this panel.`;

  const animalRule = hasCatInCut
    ? `[Animal Consistency]: A small adult domestic Korean shorthair cat (realistic quadruped cat anatomy, strictly NO human clothes on animal, natural feline fur, natural paws).`
    : hasDogInCut
    ? `[Animal Consistency]: A cute domestic pet dog (realistic quadruped canine anatomy, natural body proportions, strictly NO human clothes on animal, natural fur, natural paws).`
    : "";

  const protagonistRule = characterAppearance
    ? `- Protagonist Identity Lock: ${characterAppearance}. Natural human ears, strictly identical appearance, facial structure, hairstyle, and signature outfit across all panels in this episode.`
    : `- Protagonist Identity Lock: Korean civilian protagonist with natural human ears, neat clean hair, signature casual outfit. Strictly identical appearance and hairstyle across all panels in this episode.`;

  // 한 컷 재생성 지시문 (Intent Directives)
  let editDirective = "";
  if (params.intent === "keep_composition_change_expression") {
    editDirective = `[EDIT DIRECTIVE - EXPRESSION CHANGE ONLY]: Strictly maintain identical camera framing, identical character poses, identical body angles, and identical background composition. ONLY modify and emphasize the character's facial expression and emotional nuance (${params.customRequest ? `User Request: ${params.customRequest}` : emotionCue || "updated facial expression"}).`;
  } else if (params.intent === "replace_background") {
    editDirective = `[EDIT DIRECTIVE - BACKGROUND REPLACEMENT ONLY]: Strictly maintain identical character appearance, outfit, and character action. Completely replace and repaint the background setting with a fresh environment (${params.customRequest ? `User Request: ${params.customRequest}` : "new detailed background environment"}).`;
  } else if (params.intent === "regenerate") {
    editDirective = `[EDIT DIRECTIVE - COMPLETE RECOMPOSITION]: Generate with a completely fresh dynamic camera perspective, alternate framing angle, and new compositional staging (${params.customRequest ? `User Request: ${params.customRequest}` : "alternate camera framing and composition"}).`;
  }

  const userDirectionLine = params.customRequest
    ? `[USER CUSTOM DIRECTION]: User specifically requested: "${params.customRequest}". Ensure this direction is prominently reflected in the visual rendering.`
    : "";

  // 1. 코덱스 스타일 스캐폴딩 긍정 프롬프트
  const promptLines = [
    `[USE CASE & MEDIUM]: Korean webtoon manhwa illustration, 2D animation cel artwork, flat digital graphic novel panel.`,
    `[ART DIRECTION & STYLE]: ${styleAnchor}.`,
    `[STRICT RENDERING CONSTRAINTS]: 100% 2D flat digital graphic novel illustration, uniform clean 1.8px black contour lineart, flat solid cel shading fills with zero smooth airbrush gradients, zero 3D rendering, zero photorealism. Strictly identical color grading, identical line stroke weight, and identical visual aesthetic across all panels in this episode.`,
    `[SERIES INVARIANTS (MUST KEEP EXACTLY UNCHANGED ACROSS ALL PANELS)]:`,
    `- Exact same art style, stroke weight, and flat cel coloring across all panels in this episode.`,
    protagonistRule,
    `- Under NO circumstances should any human character have cat ears, animal ears, animal headbands, or animal costumes.`,
    `[PANEL DYNAMIC ACTION & SCENE]: ${visualScene}.`,
    editDirective,
    userDirectionLine,
    emotionCue,
    propInteractionCue,
    `[CAMERA & COMPOSITION]: ${cameraFraming}.`,
    environmentPrompt,
    `[BODY & ANATOMY]: Natural adult 6.8 heads tall Korean webtoon anatomy, slender human silhouette, normal head-to-body ratio, strictly NO chibi, NO SD, NO oversized head.`,
    humanPresenceRule,
    animalRule,
    `[LIGHTING & COLOR CONTRACT]: Soft warm interior ambient daylight (#FFFDF8 highlights), uniform color palette across all panels, zero neon lighting, zero photographic specular reflections.`,
    `[OUTPUT REQUIREMENTS]: Pure visual animation artwork, textless composition, clean drawing, consistent 6.8-head adult webtoon anatomy, strictly identical face and art style as character reference sheet.`,
  ].filter(Boolean);

  const prompt = promptLines.join("\n");

  // 2. 불변식 보호 부정 프롬프트
  const negativePrompt = [
    "text, words, letters, typography, alphabet, speech bubble, thought bubble, talk bubble, dialogue box, callout, captions, subtitle, sound effects, watermark, signature, logo, border, comic panel frame, multiple panels, split screen",
    "photorealistic, 3d render, cgi, octane render, unreal engine, volumetric lighting, airbrushed skin, skin pores, realistic photography, oil painting",
    "semi-realistic, 3d model, computer graphics, realistic human face, soft focus, blurry lines",
    "inconsistent art style, varying stroke weight, sketch, rough draft, messy lines, painterly, watercolor wash, airbrush gradients",
    "chibi, SD, super deformed, oversized head, dwarf, tiny body, toddler proportions, baby body, distorted anatomy, short stubby limbs",
    "giant eyes, huge bug eyes covering half of face, oversized anime doll eyes, baby face, toddler face, infant cheeks, compressed jaw",
    "cat ears on human, animal ears on human, animal headband, tail on human",
    "human clothes on animal, hoodie on animal, clothes zipper on animal, giant oversized animal, mutated animal paws",
    !hasMultipleHumans ? "extra people, background crowd, multiple characters, bystanders, second person" : "",
    !isSolidColor ? "empty background, blank background, simple background, white background, white void, solid color background, floating character, missing background, plain featureless wall, minimalist void" : "",
    params.intent === "keep_composition_change_expression"
      ? "altered camera angle, different camera perspective, different background setting, changed pose"
      : "",
    params.intent === "replace_background"
      ? "same background, unchanged environment, identical setting"
      : "",
  ].filter(Boolean).join(", ");

  return {
    prompt,
    negativePrompt,
    cameraFraming,
    environmentPrompt,
    emotionCue,
    propInteractionCue,
    isSolidColor,
    hasVetInCut,
    hasCatInCut,
  };
}
