/**
 * 웹툰 화풍 및 캐릭터 일관성 프롬프트 하네스 (Codex Invariants & Scaffolding)
 *
 * 코덱스(Codex)의 이미지 생성 하네스 원칙(Scaffolding, Labeled Input Roles,
 * Strict Invariants Enforcement, Specificity Normalization)을 바탕으로,
 * 회차 및 컷 간 화풍·캐릭터·선화 표류(Drift)를 차단하는 구조화된 프롬프트를 생성합니다.
 */

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
    default:
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
  if (cutText.includes("단색") || cutText.includes("solid_color")) {
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
  if (cutText.includes("침실") || cutText.includes("침대") || cutText.includes("bedroom")) {
    return {
      prompt: `[Environment & Setting]: Fully illustrated cozy Korean bedroom interior setting with architectural depth. Neat bed with duvet, wooden nightstand, desk, bookshelf, curtains with soft daylight, strictly NO empty background, NO plain white void.`,
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

  if (cutText.includes("거실") || cutText.includes("소파")) {
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
export function detectEmotionCue(cutText: string): string {
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
    return "[Facial Expression & Comical Mood]: Comical angry furrowed eyebrows, intense pouty scowl; cat hissing fiercely with bared sharp teeth, flattened airplane ears, bristled arched back.";
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
    return "[Facial Expression & Comical Mood]: Pleading gentle comic smile with sweat drops, desperate comical appeasing expression holding treats; cat with huge sparkling starry eyes eagerly staring at treats.";
  }
  return "[Facial Expression & Comical Mood]: Highly expressive dynamic Korean webtoon facial reaction fitting the active comic scene.";
}

/**
 * 소품 상호작용 큐 (Props Interaction Anchor)
 */
export function detectPropInteractionCue(cutText: string): string {
  if (cutText.includes("츄르") || cutText.includes("간식") || cutText.includes("puree")) {
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
  const cameraFraming = cameraOverride || detectCameraFraming(cutText);
  const envResult = detectEnvironment(cutText);
  const environmentPrompt = environmentOverride || envResult.prompt;
  const isSolidColor = envResult.isSolidColor;
  const emotionCue = detectEmotionCue(cutText);
  const propInteractionCue = detectPropInteractionCue(cutText);

  const hasVetInCut = cutText.includes("수의사") || cutText.includes("의사");
  const hasCatInCut = cutText.includes("고양이") || cutText.includes("냥이") || cutText.includes("cat");

  const humanPresenceRule = hasVetInCut
    ? `[Human Characters in this panel]: Exactly TWO distinct humans on opposite sides:
1) Male Veterinarian (on the left side): 40-year-old Korean male doctor with neat short black hair and glasses, wearing a blue collared shirt and clean white medical lab coat with stethoscope around neck. (STRICTLY NO hoodie on doctor, NO white hair).
2) Female Protagonist (on the right side): 20-year-old Korean civilian pet owner with dark black hair tied in low ponytail with side bangs, wearing an oversized dark grey hoodie. (STRICTLY NO lab coat on protagonist, NO stethoscope on protagonist, STRICTLY black hair).`
    : `[Human Characters in this panel]: Exactly ONE human: ONLY the female protagonist (나). Strictly NO other people, NO male characters, NO veterinarian, NO doctor, NO second person, NO bystanders in this panel.`;

  const animalRule = hasCatInCut
    ? `[Animal Consistency]: A small adult domestic Korean shorthair orange tabby cat (white chest and paws, realistic quadruped cat anatomy, natural body size about 4kg, strictly NO clothes on cat, NO clothes zipper on cat, natural feline fur, natural paws).`
    : "";

  // 1. 코덱스 스타일 스캐폴딩 긍정 프롬프트
  const promptLines = [
    `[USE CASE & MEDIUM]: Korean webtoon manhwa illustration, 2D animation cel artwork, flat digital graphic novel panel.`,
    `[ART DIRECTION & STYLE]: ${styleAnchor}.`,
    `[STRICT RENDERING CONSTRAINTS]: 100% 2D flat digital graphic novel illustration, uniform clean 1.8px black contour lineart, flat solid cel shading fills with zero smooth airbrush gradients, zero 3D rendering, zero photorealism. Strictly identical color grading, identical line stroke weight, and identical visual aesthetic across all panels in this episode.`,
    `[SERIES INVARIANTS (MUST KEEP EXACTLY UNCHANGED ACROSS ALL PANELS)]:`,
    `- Exact same art style, stroke weight, and flat cel coloring across all panels in this episode.`,
    `- Protagonist Identity Lock: 20-year-old Korean civilian girl with natural human ears (STRICTLY NO animal ears, NO cat ears, NO headband, NO animal costume, NO tail). Exact same hairstyle across all cuts: black hair tied back loosely into a low ponytail behind the neck with two distinct side curtain bangs framing her cheekbones, forehead partially visible. Exact same signature outfit across all cuts: oversized charcoal-grey hoodie (#373737, hood down) over plain white t-shirt, dark pants, sneakers.`,
    `- Under NO circumstances should any human character have cat ears, animal ears, or animal headbands. The female protagonist is strictly a civilian pet owner; she must NEVER wear a white lab coat, doctor coat, medical scrubs, or stethoscope.`,
    `[PANEL DYNAMIC ACTION & SCENE]: ${visualScene}.`,
    emotionCue,
    propInteractionCue,
    `[CAMERA & COMPOSITION]: ${cameraFraming}.`,
    environmentPrompt,
    `[BODY & ANATOMY]: Natural adult 6.8 heads tall Korean webtoon anatomy, slender human silhouette, normal head-to-body ratio, strictly NO chibi, NO SD, NO oversized head.`,
    humanPresenceRule,
    animalRule,
    characterAppearance ? `[Asset Reference Appearance]: ${characterAppearance}.` : "",
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
    "high bun, topknot, hair bun, messy bun, hair scrunchie, hair updo, chignon, wearing hood over head, hood pulled up, hood covering head, altered hairstyle, different hairstyle, white hair on protagonist, grey hair on protagonist",
    "cat ears on human, animal ears on human, animal headband, tail on human",
    "human clothes on cat, hoodie on cat, clothes zipper on cat, giant oversized cat, mutated animal paws",
    "doctor coat on protagonist, scrubs on protagonist, stethoscope on protagonist, hoodie on doctor",
    !hasVetInCut ? "veterinarian, male doctor, medical coat, extra people, male characters" : "",
    !isSolidColor ? "empty background, blank background, simple background, white background, white void, solid color background, floating character, missing background, plain featureless wall, minimalist void" : "",
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
