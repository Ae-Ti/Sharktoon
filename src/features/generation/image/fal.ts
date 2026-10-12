/**
 * Fal.ai (Flux.1 schnell / dev) 이미지 생성기
 *
 * fal.ai API 키를 사용하여 컷 및 캐릭터 시트를 생성합니다.
 * schnell: 4-step 초고속·초저가(장당 약 5원), 출석 보상 및 빠른 테스트에 최적
 * dev: 28-step 고품질 모델 + Redux 레퍼런스 주입으로 캐릭터 일관성 유지
 */

import {
  CHARACTER_SHEET_LABEL,
  CHARACTER_SHEET_VIEWS,
  type CharacterSheetRequest,
  type CharacterSheetResult,
  type CutGenerationRequest,
  type CutGenerationResult,
  type ImageGenerator,
} from "@/contracts/generation";

function getApiKey(): string {
  const key = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!key) {
    throw new Error("FAL_KEY 환경변수가 설정되지 않았습니다.");
  }
  return key;
}

function resolveStylePrompt(style?: string): string {
  switch (style) {
    case "파스텔":
    case "pastel":
      return "soft pastel flat cel colors with uniform 1.5px black ink outlines, warm cozy Korean slice-of-life manhwa style";
    case "굵은 선":
    case "bold_line":
      return "bold crisp black ink outlines with uniform 2.5px stroke weight, punchy vibrant flat solid cel shading, modern expressive manhwa style";
    case "심플 라인":
    case "simple_line":
    default:
      return "clean black ink contour lineart with uniform 1.5px stroke weight, flat solid cel shading with crisp hard shadow boundaries, zero gradients, modern Korean webtoon manhwa style";
  }
}

function getEpisodeSeed(episodeId?: string, cutIndex: number = 1): number {
  if (!episodeId) return 42;
  let hash = 0;
  for (let i = 0; i < episodeId.length; i++) {
    hash = (hash * 31 + episodeId.charCodeAt(i)) >>> 0;
  }
  return (hash + (cutIndex - 1) * 37) % 2147483647;
}

function enhancePropsAndActions(text: string): string {
  let res = text;
  if (res.includes("츄르")) {
    res = res.replace(/츄르(\s*두\s*개)?/g, "손가락으로 쥐고 짜주는 붉은색 스틱형 고양이 퓨레 간식 튜브 파우치(slender cat puree treat squeeze tube)");
  }
  if (res.includes("하악질")) {
    res = res.replace(/하악질/g, "송곳니를 드러내고 입을 크게 벌려 귀를 뒤로 눕히고 털을 곤두세우며 사납게 하악질(cat hissing aggressively with bared sharp teeth)");
  }
  if (res.includes("이동장") || res.includes("캐리어")) {
    res = res.replace(/(이동장|캐리어)/g, "바닥에 놓인 문이 열린 플라스틱 반려동물 이동장 케이지(plastic pet carrier crate)");
  }
  return res;
}

async function translateToVisualEnglishPrompt(text: string, apiKey: string): Promise<string> {
  if (!/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) return text;
  const enhancedText = enhancePropsAndActions(text);

  try {
    const res = await fetch("https://fal.run/fal-ai/any-llm", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_prompt:
          "You are an expert visual prompt engineer for 2D Korean webcomic manhwa image generation. Translate the user's Korean comic scene, character actions, and emotions into a clear English visual scene description sentence.\n" +
          "CRITICAL RULES:\n" +
          "1. Protagonist identity: The main character is ALWAYS an ordinary civilian young woman with natural human ears (STRICTLY NO animal ears, NO cat ears headband, NO tail) in casual clothing (dark grey hoodie over white t-shirt, dark pants). NEVER dress the protagonist in professional uniforms (like a doctor's white coat or scrubs) and NEVER put a stethoscope on her.\n" +
          "2. Secondary characters: If a veterinarian or doctor is present, describe them distinctly as a separate male character (e.g. 'A separate male veterinarian in a white lab coat examines the cat while the female protagonist watches').\n" +
          "3. Animal & Prop consistency: Always preserve specific visual details such as cat breed and color (e.g. 'a chubby grey tabby cat with white chest and paws') identically.\n" +
          "4. Concrete facial expressions: Translate abstract emotions into physical facial cues (e.g., instead of just 'embarrassed', use 'flustered expression, wide eyes, a drop of cold sweat'; instead of 'discontent', use 'pouting sulky expression, folded arms'; instead of 'moved/touched', use 'warm gentle smile, touched sparkling eyes').\n" +
          "5. Concrete Props & Physical Interactions: When props appear, explicitly describe the hand interaction and shape:\n" +
          "- '츄르' or '간식': Translate as 'holding and squeezing a slender red tube sachet of cat puree treat with fingers, creamy paste coming out from the tip directly toward the cat'.\n" +
          "- '이동장' or '캐리어': Translate as 'a plastic pet travel carrier crate with metal grill door open on the floor'.\n" +
          "- '하악질': Translate as 'cat hissing aggressively with wide open mouth, bared sharp teeth, flattened airplane ears, arched back with bristled fur'.\n" +
          "- '식은땀' / '당황' / '뒤로 주저앉음': Translate as 'falling backward and sitting flat on the floor in comical shock, nervous cold sweat drop on temple, wide alarmed eyes'.\n" +
          "- '양반다리': Translate as 'sitting cross-legged flat on the wooden floor'.\n" +
          "- '스탠딩' / '서서' / '선 채로': Translate as 'standing upright in full-body posture'.\n" +
          "- '무릎 꿇고' / '앞으로 숙여': Translate as 'kneeling on both knees, leaning torso forward with hands outstretched'.\n" +
          "- '엉덩방아' / '손사래': Translate as 'recoiling backward in comedic panic, frantically waving hands to placate the hissing cat'.\n" +
          "Output ONLY the English sentence without quotes or preamble.",
        prompt: enhancedText,
      }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    const translated = String(data.output || "").trim();
    return translated || text;
  } catch {
    return text;
  }
}

export class FalFluxGenerator implements ImageGenerator {
  private variant: "schnell" | "dev";

  constructor(variant: "schnell" | "dev" = "schnell") {
    this.variant = variant;
  }

  async generateCut(req: CutGenerationRequest): Promise<CutGenerationResult> {
    const apiKey = getApiKey();
    const stylePrompt = resolveStylePrompt(String(req.seriesRule?.stylePreset ?? "심플 라인"));
    const is4to5 = req.seriesRule?.aspectRatio === "4:5";
    const image_size = is4to5 ? { width: 1080, height: 1350 } : { width: 1024, height: 1024 };

    // Flux는 영문 프롬프트만 이해하므로, 한글 씬 지문 및 캐릭터 특징을 실시간 비주얼 영문 프롬프트로 변환
    const visualScene = await translateToVisualEnglishPrompt(req.prompt, apiKey);

    // 온보딩/에셋에서 지정된 캐릭터 특징(태그, 설명) 중 현재 컷에 등장하는 요소만 필터링 주입
    const rawTraits = Array.isArray(req.seriesRule?.characterTraits)
      ? (req.seriesRule.characterTraits as string[]).filter(Boolean)
      : [];
    const cutText = req.prompt;
    const activeTraits = rawTraits.filter((trait) => {
      const parts = trait.split(",").map((s) => s.trim()).filter(Boolean);
      return parts.some((p) => p.length >= 2 && cutText.includes(p));
    });
    const characterAppearance = activeTraits.length > 0
      ? await translateToVisualEnglishPrompt(activeTraits.join(", "), apiKey)
      : "";

    const hasVetInCut = cutText.includes("수의사") || cutText.includes("의사");
    const humanPresenceRule = hasVetInCut
      ? `[Human Characters in this panel]: Exactly TWO distinct humans on opposite sides:
1) Male Veterinarian (on the left side): 40-year-old Korean male doctor with neat short black hair and glasses, wearing a blue collared shirt and clean white medical lab coat with stethoscope around neck. (STRICTLY NO hoodie on doctor, NO white hair).
2) Female Protagonist (on the right side): 20-year-old Korean civilian pet owner with dark black hair tied in low ponytail with side bangs, wearing an oversized dark grey hoodie. (STRICTLY NO lab coat on protagonist, NO stethoscope on protagonist, STRICTLY black hair).`
      : `[Human Characters in this panel]: Exactly ONE human: ONLY the female protagonist (나). Strictly NO other people, NO male characters, NO veterinarian, NO doctor, NO second person, NO bystanders in this panel.`;

    // 1. 카메라 프레이밍 및 구도 다양화 감지
    let cameraFraming = "Dynamic medium shot (waist up), eye-level angle";
    if (cutText.includes("익스트림 클로즈업") || cutText.includes("extreme_close_up")) {
      cameraFraming = "Intense dramatic extreme close-up shot focused tightly on expressive comic facial reaction, wide eyes, and trembling mouth";
    } else if (cutText.includes("클로즈업") || cutText.includes("close_up")) {
      cameraFraming = "Close-up portrait shot (upper chest and expressive head), dynamic comic reaction framing";
    } else if (cutText.includes("부감") || cutText.includes("top_down") || cutText.includes("하이앵글")) {
      cameraFraming = "High-angle shot (looking down from above), overhead comic perspective showing character's interaction with the cat and props on the floor";
    } else if (cutText.includes("오버 숄더") || cutText.includes("over_shoulder")) {
      cameraFraming = "Over-the-shoulder shot framing one character from behind looking across at the other character's dramatic reaction";
    } else if (cutText.includes("익스트림 롱") || cutText.includes("extreme_wide")) {
      cameraFraming = "Wide establishing shot showing the entire room environment and full standing character figures";
    } else if (cutText.includes("롱") || cutText.includes("wide") || cutText.includes("풀샷")) {
      cameraFraming = "Full-length body shot showing characters from head to shoes with architectural background depth";
    } else if (cutText.includes("로우앵글") || cutText.includes("low_angle")) {
      cameraFraming = "Dynamic low-angle shot looking up, creating comic drama and tension";
    }

    // 2. 배경 엔진 (단색 컬러 vs 3D 스케치업풍 인테리어)
    let backgroundPrompt = "";
    let isSolidColor = false;
    if (cutText.includes("단색") || cutText.includes("solid_color")) {
      isSolidColor = true;
      const hexMatch = cutText.match(/#[0-9a-fA-F]{6}/);
      const colorHex = hexMatch ? hexMatch[0] : "#FFF9F0";
      backgroundPrompt = `[Background]: Solid flat pastel background (${colorHex}), minimalist clean comic colored backdrop, zero clutter, clean graphic design negative space, studio color backdrop.`;
    } else if (cutText.includes("동물병원") || cutText.includes("진료실") || cutText.includes("vet_clinic")) {
      backgroundPrompt = `[Environment & Background]: Fully illustrated detailed veterinary clinic interior setting with architectural depth. Stainless steel examination counter, background shelves stocked with pet medicines and veterinary supplies, medical posters on the wall, clinic window and consultation desk, overhead clinical ambient lighting, strictly NO empty background, NO plain white void.`;
    } else if (cutText.includes("현관") || cutText.includes("entrance")) {
      backgroundPrompt = `[Environment & Background]: Fully illustrated modern Korean apartment entrance hallway setting with architectural depth. Digital door lock front door, shoe rack with shoes, clean tiled entryway floor, baseboards, hallway wall molding, ceiling entrance lighting, strictly NO empty background, NO plain white void.`;
    } else if (cutText.includes("침실") || cutText.includes("침대") || cutText.includes("bedroom")) {
      backgroundPrompt = `[Environment & Background]: Fully illustrated cozy Korean bedroom interior setting with architectural depth. Neat bed with duvet, wooden nightstand, desk, bookshelf, curtains with soft daylight, strictly NO empty background, NO plain white void.`;
    } else if (cutText.includes("카페") || cutText.includes("cafe")) {
      backgroundPrompt = `[Environment & Background]: Fully illustrated cozy aesthetic cafe interior setting with architectural depth. Wooden tables, cafe counter in background, warm pendant lights, large glass cafe window with city view, strictly NO empty background, NO plain white void.`;
    } else if (cutText.includes("사무실") || cutText.includes("회사") || cutText.includes("office")) {
      backgroundPrompt = `[Environment & Background]: Fully illustrated modern corporate office interior setting with architectural depth. Office desks, monitors, office partition, water cooler in background, professional interior lighting, strictly NO empty background, NO plain white void.`;
    } else {
      // 거실 또는 기본 인테리어
      backgroundPrompt = `[Environment & Background]: Fully illustrated cozy modern Korean apartment living room interior setting with architectural depth. Warm light wooden flooring with subtle grain, fabric sofa and cushions in the background, low coffee table, baseboards, window blinds with ambient daylight, lived-in interior props, strictly NO empty background, NO plain white void.`;
    }

    // 3. 동물 일관성 및 의상 오류 방지
    const hasCatInCut = cutText.includes("고양이") || cutText.includes("냥이") || cutText.includes("cat");
    const animalRule = hasCatInCut
      ? `[Animal Consistency]: A small adult domestic Korean shorthair orange tabby cat (white chest and paws, realistic quadruped cat anatomy, natural body size about 4kg, strictly NO clothes on cat, NO clothes zipper on cat, natural feline fur, natural paws).`
      : "";

    const seed = getEpisodeSeed(req.episodeId, req.index);

    const negative_prompt = [
      "semi-realistic, 3d render, photorealistic, realistic photo, hyperrealistic, oil painting",
      "chibi, SD, super deformed, oversized head, dwarf, tiny body, toddler proportions, baby body, distorted anatomy, short stubby limbs",
      "giant eyes, huge bug eyes covering half of face, oversized anime doll eyes, baby face, toddler face, infant cheeks, compressed jaw",
      "soft shading, painterly, uneven linework, sketchy, messy lines, scratchy lineart, varying line weight",
      "smooth airbrush, gradients, volumetric lighting, watercolor, colored pencil, blurry lines, soft focus",
      "high bun, topknot, hair bun, messy bun, hair scrunchie, hair updo, chignon, wearing hood over head, hood pulled up, hood covering head, altered hairstyle, different hairstyle, white hair on protagonist, grey hair on protagonist",
      "cat ears on human, animal ears on human, animal headband, tail on human",
      "human clothes on cat, hoodie on cat, clothes zipper on cat, giant oversized cat, mutated animal paws",
      "doctor coat on protagonist, scrubs on protagonist, stethoscope on protagonist, hoodie on doctor",
      !hasVetInCut ? "veterinarian, male doctor, medical coat, extra people, male characters" : "",
      !isSolidColor ? "empty background, blank background, simple background, white background, white void, solid color background, floating character, missing background, plain featureless wall, minimalist void" : "",
      "text, speech bubble, dialogue box, captions, watermark, signature",
    ].filter(Boolean).join(", ");

    // 4. 감정에 따른 만화적 표정 큐 (극적이고 과장된 만화 리액션 강제)
    let emotionCue = "";
    if (cutText.includes("놀람") || cutText.includes("surprise") || cutText.includes("당황") || cutText.includes("식은땀") || cutText.includes("경악")) {
      emotionCue = "[Facial Expression & Comical Mood]: Highly exaggerated comic shock expression: wide panicked manga eyes, big visible nervous cold sweat drop on temple, comical open screaming/gasping mouth, flustered flushed cheeks.";
    } else if (cutText.includes("분노") || cutText.includes("anger") || cutText.includes("화난") || cutText.includes("하악질") || cutText.includes("짜증")) {
      emotionCue = "[Facial Expression & Comical Mood]: Comical angry furrowed eyebrows, intense pouty scowl; cat hissing fiercely with bared sharp teeth, flattened airplane ears, bristled arched back.";
    } else if (cutText.includes("슬픔") || cutText.includes("sadness") || cutText.includes("억울") || cutText.includes("지친") || cutText.includes("한숨")) {
      emotionCue = "[Facial Expression & Comical Mood]: Comical wronged despair, trembling watery eyes, downturned pouty mouth, completely exhausted slump in comical misery.";
    } else if (cutText.includes("사랑") || cutText.includes("love") || cutText.includes("기쁨") || cutText.includes("joy") || cutText.includes("츄르") || cutText.includes("간절")) {
      emotionCue = "[Facial Expression & Comical Mood]: Pleading gentle comic smile with sweat drops, desperate comical appeasing expression holding treats; cat with huge sparkling starry eyes eagerly staring at treats.";
    } else {
      emotionCue = "[Facial Expression & Comical Mood]: Highly expressive dynamic Korean webtoon facial reaction fitting the active comic scene.";
    }

    // 5. 소품 상호작용 강화 큐 (손동작과 물리적 상호작용 우선)
    let propInteractionCue = "";
    if (cutText.includes("츄르") || cutText.includes("간식") || cutText.includes("puree")) {
      propInteractionCue = "[Props & Hands Interaction]: Main character's hands are actively holding and squeezing a slender red tube sachet of cat puree treat, with creamy treat paste protruding from the tip directly toward the cat's mouth.";
    } else if (cutText.includes("카드") || cutText.includes("결제")) {
      propInteractionCue = "[Props & Hands Interaction]: Main character is holding and extending a credit card in hand towards the counter.";
    } else if (cutText.includes("이동장") || cutText.includes("캐리어")) {
      propInteractionCue = "[Props & Scene Props]: A plastic pet travel carrier box rests open on the floor nearby.";
    }

    const prompt = [
      `A single panel from a 2D Korean webcomic manhwa, soft line art style.`,
      `Art Style: soft line art, ${stylePrompt}, clean ink lineart, flat solid cel shading with crisp shadow boundaries, zero gradients, clean digital webtoon comic aesthetic.`,
      `[Key Dynamic Action & Poses]: ${visualScene}.`,
      emotionCue,
      propInteractionCue,
      `[Camera & Composition]: ${cameraFraming}.`,
      backgroundPrompt,
      `[Body & Anatomy]: Realistic 6.5 to 7.0 heads tall natural adult human proportions, anatomically correct Korean manhwa anatomy, slender young adult female silhouette, natural limb lengths, normal head-to-body ratio, strictly NO chibi, NO super-deformed (SD) style, NO oversized head, NO dwarfism.`,
      `[Facial Proportions]: Delicate, proportionate Korean manhwa facial features, natural eye size fitting modern webtoon aesthetics (NOT oversized bug-eyes, NOT chibi doll eyes), well-defined slender jawline, refined small nose, natural lips, mature 20-year-old female face structure.`,
      `[Protagonist (Main Character)]: 20-year-old Korean human girl with natural human ears (STRICTLY NO animal ears, NO cat ears, NO headband, NO animal costume, NO tail). Exact same hairstyle across all cuts: black hair tied back loosely into a low ponytail behind the neck with two distinct side curtain bangs framing her face/cheekbones, forehead partially visible, strictly NO top bun, NO hair scrunchie, NO hair updo. Exact same signature outfit: dark grey oversized zip-up hoodie (hood resting down on shoulders, NEVER pulled over head) over a dark t-shirt, dark pants, sneakers.`,
      humanPresenceRule,
      animalRule,
      characterAppearance ? `[Asset & Character References]: ${characterAppearance}.` : "",
      `[Lighting & Color]: Soft neutral indoor ambient daylight, clear balanced lighting, crisp hard cel-shading shadow boundaries, consistent color temperature across all panels, strictly zero neon lighting reflection, zero dramatic rim light, zero photographic reflections.`,
      `[Strict Negative Constraints]: Under NO circumstances should any human character have cat ears, animal ears, or animal headbands. The female protagonist is strictly a civilian pet owner; she must NEVER wear a white lab coat, doctor coat, medical scrubs, or stethoscope. ${
        !hasVetInCut
          ? "STRICTLY NO veterinarian, NO doctor, NO male characters in this panel. There is ONLY one person: the female protagonist."
          : ""
      }`,
      `Requirements: Clean composition, consistent 6.5-head adult webtoon anatomy, strictly identical face and hairstyle as character reference sheet, no speech bubbles, no text, no captions.`,
    ].filter(Boolean).join("\n");

    console.log(`\n🎨 [FLUX Cut ${req.index}] Final Prompt:\n${prompt}\n`);
    console.log(`🛑 [FLUX Cut ${req.index}] Negative Prompt:\n${negative_prompt}\n`);

    // 고정 레퍼런스 이미지 (캐릭터 시트 정면/전신 뷰 또는 사용자 에셋 레퍼런스)
    const referenceImageUrl = req.characterSheetRefs?.[0] || req.assetRefs?.[0];

    // 레퍼런스 이미지가 있고 dev 모델인 경우 PuLID(Plug-and-Play Identity)를 사용하여 얼굴/인물/화풍을 완전 고정
    const usePuLID = Boolean(referenceImageUrl && this.variant === "dev");
    const endpoint = usePuLID
      ? "https://fal.run/fal-ai/flux-pulid"
      : `https://fal.run/fal-ai/flux/${this.variant}`;

    const loras = [
      {
        path: "alvdansen/soft-line-flux",
        scale: 0.75,
      },
    ];

    const body: Record<string, unknown> = usePuLID
      ? {
          prompt,
          negative_prompt,
          reference_image_url: referenceImageUrl,
          id_weight: 0.75, // Goldilocks ratio: 0.75 maintains strict face/hair identity lock while granting rich emotional expression and pose freedom
          guidance_scale: 3.8, // 4.5 -> 3.8로 안정화
          true_cfg: 1.0,
          max_sequence_length: "512",
          num_inference_steps: 28,
          seed,
          width: image_size.width,
          height: image_size.height,
          loras,
        }
      : {
          prompt,
          negative_prompt,
          image_size,
          num_inference_steps: this.variant === "schnell" ? 4 : 28,
          num_images: 1,
          seed,
          enable_safety_checker: true,
          loras,
        };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Fal.ai Flux (${this.variant}) 실패 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const img = data.images?.[0];
    if (!img?.url) {
      throw new Error("Fal.ai 응답에 이미지 URL이 없습니다.");
    }

    return {
      cutId: req.cutId,
      imageUrl: img.url,
      metadata: {
        model: usePuLID ? "flux-pulid" : `flux-1-${this.variant}`,
        seed: usePuLID ? seed : (data.seed ?? seed),
        generatedAt: new Date().toISOString(),
        aiGenerated: true,
      },
    };
  }

  async generateCharacterSheet(req: CharacterSheetRequest): Promise<CharacterSheetResult> {
    const apiKey = getApiKey();
    const stylePrompt = resolveStylePrompt(req.style);
    const tagsPrompt = req.tags?.length ? `Tags: ${req.tags.join(", ")}.` : "";
    const rawDesc = [req.tags?.join(", "), req.description].filter(Boolean).join(" ");
    const translatedDesc = rawDesc ? await translateToVisualEnglishPrompt(rawDesc, apiKey) : "";
    const descPrompt = translatedDesc ? `Description: ${translatedDesc}.` : "";
    const endpoint = `https://fal.run/fal-ai/flux/${this.variant}`;

    const results = await Promise.allSettled(
      CHARACTER_SHEET_VIEWS.map(async (view, idx) => {
        let viewDesc = "";
        switch (view) {
          case "front":
            viewDesc = "front view, neutral standing pose, looking forward directly at camera";
            break;
          case "side":
            viewDesc = "side profile view, 90 degree side standing pose";
            break;
          case "expression_joy":
            viewDesc = "close-up face portrait, joyous happy smiling expression, sparkling eyes";
            break;
          case "expression_sad":
            viewDesc = "close-up face portrait, sad crying gloomy expression, teary eyes";
            break;
          case "expression_angry":
            viewDesc = "close-up face portrait, angry upset fierce expression, furrowed eyebrows";
            break;
          case "expression_surprised":
            viewDesc = "close-up face portrait, surprised shocked wide eyes expression, open mouth";
            break;
          case "full_body":
            viewDesc = "full body view, cheerful casual standing pose showing full outfit and shoes";
            break;
        }

        const negative_prompt = [
          "semi-realistic, 3d render, photorealistic, realistic photo, hyperrealistic, oil painting",
          "chibi, SD, super deformed, oversized head, dwarf, tiny body, toddler proportions, baby body, distorted anatomy, short stubby limbs",
          "giant eyes, huge bug eyes covering half of face, oversized anime doll eyes, baby face, toddler face, infant cheeks, compressed jaw",
          "soft shading, painterly, uneven linework, sketchy, messy lines, scratchy lineart, varying line weight",
          "smooth airbrush, gradients, volumetric lighting, watercolor, colored pencil, blurry lines, soft focus",
          "high bun, topknot, hair bun, messy bun, hair scrunchie, hair updo, chignon, wearing hood over head, hood pulled up, hood covering head, altered hairstyle",
          "realistic skin pores, realistic eyes, photographic lighting, dark shadows",
          "room, interior, bedroom, furniture, wall, colored background, complex background, shadow on wall",
          "cat ears on human, animal ears on human, animal headband, tail on human",
          "doctor coat, lab coat, medical scrubs, stethoscope",
          "text, speech bubble, dialogue box, captions, watermark, signature",
        ].join(", ");

        const prompt = [
          `A character design sheet for a 2D Korean webcomic manhwa character '${req.name}', soft line art style.`,
          `Art Style: soft line art, ${stylePrompt}, clean ink lineart, flat solid cel shading with crisp hard shadow boundaries, zero gradients, clean digital webcomic aesthetic.`,
          `[Body & Anatomy]: Realistic 6.5 to 7.0 heads tall natural adult proportions, anatomically correct Korean manhwa anatomy, slender young adult female silhouette, natural limb lengths, normal head-to-body ratio, strictly NO chibi, NO super-deformed (SD) style, NO oversized head, NO dwarfism.`,
          `[Facial Proportions]: Delicate, proportionate Korean manhwa facial features, natural eye size fitting modern webtoon aesthetics (NOT oversized bug-eyes, NOT chibi doll eyes), well-defined slender jawline, refined small nose, natural lips, mature 20-year-old female face structure.`,
          `View & Pose: ${viewDesc}.`,
          `Background: pure solid flat white background (#FFFFFF), neutral flat high-key studio lighting, strictly NO background elements, NO room, NO furniture, NO shadows on floor, isolated character model reference sheet.`,
          `[Character Appearance]: 20-year-old Korean human girl with natural human ears (STRICTLY NO animal ears, NO cat ears, NO headband, NO animal costume, NO tail). Exact same hairstyle: black hair tied back loosely into a low ponytail behind the neck with two distinct side curtain bangs framing her face/cheekbones, forehead partially visible, strictly NO top bun, NO hair scrunchie. Casual signature outfit: dark grey oversized zip-up hoodie (hood resting down on shoulders, NEVER pulled over head) over a dark t-shirt, dark pants, sneakers.`,
          descPrompt,
          tagsPrompt,
          `Strict Requirements: Clean 2D outline drawing, flat solid cel shading, pure white background, consistent 6.5-head adult proportions, no text, no speech bubbles, no watermark.`,
        ]
          .filter(Boolean)
          .join("\n");

        console.log(`\n🎨 [FLUX Sheet View: ${view}] Prompt:\n${prompt}\n`);

        const usePuLID = Boolean(req.selfieUrl && this.variant === "dev");
        const sheetEndpoint = usePuLID
          ? "https://fal.run/fal-ai/flux-pulid"
          : endpoint;

        const seed = (getEpisodeSeed(req.name, idx + 1) + idx * 101) % 2147483647;

        const sheetLoras = [
          {
            path: "alvdansen/soft-line-flux",
            scale: 0.75,
          },
        ];

        const body: Record<string, unknown> = usePuLID
          ? {
              prompt,
              negative_prompt,
              reference_image_url: req.selfieUrl,
              id_weight: 1.0,
              guidance_scale: 3.8,
              true_cfg: 1.0,
              max_sequence_length: "512",
              num_inference_steps: 28,
              seed,
              width: 1024,
              height: 1024,
              loras: sheetLoras,
            }
          : {
              prompt,
              image_size: { width: 1024, height: 1024 },
              num_inference_steps: this.variant === "schnell" ? 4 : 28,
              num_images: 1,
              seed,
              enable_safety_checker: true,
              loras: sheetLoras,
            };

        const res = await fetch(sheetEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Key ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`캐릭터 뷰(${CHARACTER_SHEET_LABEL[view]}) 생성 실패: ${res.status} - ${errText}`);
        }

        const data = await res.json();
        const img = data.images?.[0];
        return {
          view,
          imageUrl: img?.url ?? "",
        };
      })
    );

    const views = results
      .filter((r): r is PromiseFulfilledResult<{ view: (typeof CHARACTER_SHEET_VIEWS)[number]; imageUrl: string }> => r.status === "fulfilled" && Boolean(r.value.imageUrl))
      .map((r) => r.value);

    if (views.length === 0) {
      throw new Error(`캐릭터 시트 생성 실패: Fal.ai 응답을 받지 못했습니다.`);
    }

    return {
      views,
      metadata: {
        model: `flux-1-${this.variant}`,
        generatedAt: new Date().toISOString(),
        aiGenerated: true,
      },
    };
  }

  supportsInpainting(): boolean {
    return this.variant === "dev";
  }
}
