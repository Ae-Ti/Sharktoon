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
  SafetyBlockedError,
  type CharacterSheetRequest,
  type CharacterSheetResult,
  type CutGenerationRequest,
  type CutGenerationResult,
  type ImageGenerator,
} from "@/contracts/generation";
import { buildStructuredWebtoonPrompt } from "./promptBuilder";


export function getApiKey(): string {
  const key = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!key) {
    throw new Error("FAL_KEY 환경변수가 설정되지 않았습니다.");
  }
  return key;
}

export function resolveStylePrompt(style?: string): string {
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
      return "clean black ink contour lineart with uniform 1.5px stroke weight, flat solid cel shading with crisp hard shadow boundaries, zero gradients, zero 3D rendering, modern Korean slice-of-life webtoon manhwa style";
  }
}

export function getEpisodeSeed(episodeId?: string, cutIndex: number = 1, attempt: number = 1): number {
  if (!episodeId) return 42;
  let hash = 0;
  for (let i = 0; i < episodeId.length; i++) {
    hash = (hash * 31 + episodeId.charCodeAt(i)) >>> 0;
  }
  const baseSeed = hash % 2000000000;
  // Sequential latent clustering: use tight seed step (x 3) so cuts in the same episode share the same artistic manifold
  // If attempt > 1 (one-cut regeneration), offset by prime stride to get fresh composition
  return (baseSeed + (cutIndex - 1) * 3 + (attempt - 1) * 7919) % 2147483647;
}

export function enhancePropsAndActions(text: string): string {
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

export function cleanTextless(text: string): string {
  return text
    .replace(/말풍선[^\n/]*/g, "")
    .replace(/대사[^\n/]*/g, "")
    .replace(/나레이션[^\n/]*/g, "")
    .replace(/글자[^\n/]*/g, "")
    .replace(/자막[^\n/]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function translateToVisualEnglishPrompt(text: string, apiKey: string): Promise<string> {
  const cleaned = cleanTextless(text);
  if (!/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(cleaned)) return cleaned;
  const enhancedText = enhancePropsAndActions(cleaned);

  try {
    const res = await fetch("https://fal.run/fal-ai/any-llm", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_prompt:
          "You are an expert visual prompt engineer for 2D Korean webcomic animation image generation. Translate the user's Korean scene, character actions, and emotions into a clear English visual scene description sentence.\n" +
          "CRITICAL INSTRUCTION FOR TEXTLESS VISUAL ART:\n" +
          "Under NO circumstances should you output or describe speech bubbles, dialogue balloons, text, sound effects, subtitles, or captions. Do NOT use words like 'speech bubble', 'text', 'dialogue', 'balloon', or 'caption'. Focus EXCLUSIVELY on visual scene elements: character poses, hand gestures, facial expressions, and background objects.\n" +
          "CRITICAL RULES:\n" +
          "1. Protagonist identity: The main character is an ordinary civilian person with natural human ears (STRICTLY NO animal ears, NO animal headband, NO tail). Faithfully depict the character's gender, hairstyle, and outfit as specified in the scene. NEVER dress the protagonist in professional uniforms (like a doctor's white coat or scrubs) unless the scene explicitly specifies it.\n" +
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
    if (!res.ok) return cleaned;
    const data = await res.json();
    const translated = String(data.output || "").trim();
    return translated || cleaned;
  } catch {
    return cleaned;
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

    const requestMatch = cutText.match(/요청:\s*([^\n]+)/);
    const rawCustomRequest = requestMatch ? requestMatch[1].trim() : undefined;
    let customRequest = rawCustomRequest;
    if (rawCustomRequest && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(rawCustomRequest)) {
      try {
        customRequest = await translateToVisualEnglishPrompt(rawCustomRequest, apiKey);
      } catch {
        customRequest = rawCustomRequest;
      }
    }

    const structured = buildStructuredWebtoonPrompt({
      cutIndex: req.index,
      cutText,
      visualScene,
      stylePreset: String(req.seriesRule?.stylePreset ?? "심플 라인"),
      characterAppearance,
      intent: req.intent,
      customRequest,
    });
    const prompt = structured.prompt;
    const negative_prompt = structured.negativePrompt;
    const seed = getEpisodeSeed(req.episodeId, req.index, req.attempt ?? 1);


    console.log(`\n🎨 [FLUX Cut ${req.index}] Final Prompt:\n${prompt}\n`);
    console.log(`🛑 [FLUX Cut ${req.index}] Negative Prompt:\n${negative_prompt}\n`);

    // 고정 레퍼런스 이미지 (캐릭터 시트 정면/전신 뷰, 사용자 에셋 레퍼런스, 또는 커스텀 화풍 사진)
    const allCandidates = [
      ...(req.characterSheetRefs ?? []),
      ...(req.assetRefs ?? []),
      req.seriesRule?.customStyleImageUrl as string | undefined,
    ].filter(Boolean);

    let referenceImageUrl: string | undefined;
    for (const url of allCandidates) {
      if (
        url &&
        !url.startsWith("data:image/svg") &&
        !url.endsWith(".svg") &&
        (url.startsWith("http://") ||
          url.startsWith("https://") ||
          url.startsWith("data:image/jpeg") ||
          url.startsWith("data:image/png") ||
          url.startsWith("data:image/webp"))
      ) {
        referenceImageUrl = url;
        break;
      }
    }

    // 레퍼런스 이미지가 있고 dev 모델인 경우 PuLID(Plug-and-Play Identity)를 사용하여 얼굴/인물/화풍을 완전 고정
    // 사용자가 명시적으로 임의 AI 얼굴(skipFaceLock)을 원하지 않는 한 고정 레퍼런스를 적용합니다.
    let usePuLID = Boolean(referenceImageUrl && this.variant === "dev" && !req.skipFaceLock);

    // LoRA 적용: fal-ai/flux-lora 엔드포인트는 실제 LoRA 가중치를 로드하여 일관된 2D 웹툰 라인아트를 강제합니다.
    const loras = [
      {
        path: "alvdansen/soft-line-flux",
        scale: 0.9,
      },
    ];

    const isInpainting = req.intent === "inpaint_mask" && Boolean(req.maskUrl) && Boolean(req.baseImageUrl);

    let endpoint = isInpainting
      ? "https://fal.run/fal-ai/flux-lora/inpainting"
      : usePuLID
        ? "https://fal.run/fal-ai/flux-pulid"
        : `https://fal.run/fal-ai/flux/${this.variant}`;

    const makeBaseBody = () => ({
      prompt,
      negative_prompt,
      image_size,
      num_inference_steps: this.variant === "schnell" ? 4 : 28,
      num_images: 1,
      seed,
      enable_safety_checker: true,
      ...(this.variant === "dev" ? { guidance_scale: 3.5 } : {}),
    });

    const body: Record<string, unknown> = isInpainting
      ? {
          prompt,
          image_url: req.baseImageUrl,
          mask_url: req.maskUrl,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          seed,
          loras,
        }
      : usePuLID
        ? {
            prompt,
            negative_prompt,
            reference_image_url: referenceImageUrl,
            id_weight: 0.72, // 0.72: 얼굴 ID를 견고하게 유지하면서 2D 웹툰 화풍 프롬프트가 이목구비에 정상 반영되도록 보장
            guidance_scale: 3.5,
            true_cfg: 2.2, // true_cfg 2.2: negative_prompt를 활성화하여 3D/실사 질감을 강력하게 억제하고 2D 셀채색 화풍을 강제
            max_sequence_length: "512",
            num_inference_steps: 28,
            seed,
            width: image_size.width,
            height: image_size.height,
          }
        : makeBaseBody();

    let res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // PuLID 얼굴 인식 실패(400: no face detected / facexlib align face fail) 감지 시
    // 임의의 얼굴을 그리는 표준 모델로 몰래 자동 폴백하지 않고, 사용자에게 정면 사진 등록 필요성을 정확히 안내합니다.
    if (!res.ok && usePuLID) {
      const errText = await res.text();
      const isFaceRecognitionFailure =
        errText.includes("no face detected") ||
        errText.includes("align face fail") ||
        errText.includes("ID embeddings");

      if (isFaceRecognitionFailure) {
        console.error(
          `❌ [Fal.ai] PuLID 안면 인식 실패 (facexlib align face fail). 자동 폴백 대신 사용자에게 얼굴 인식 실패를 안내합니다.`
        );
        throw new Error(
          "캐릭터 사진에서 얼굴 인식을 실패했습니다 (facexlib align face fail: 정면 얼굴 감지 불가). 이목구비가 가려지지 않고 선명한 정면 사진을 등록해 주세요."
        );
      } else {
        throw new Error(`Fal.ai Flux (${this.variant}) 실패 (${res.status}): ${errText}`);
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Fal.ai Flux (${this.variant}) 실패 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    // 안전 검사에 걸리면 fal 은 오류 대신 검은 이미지를 준다. 저장하지 않고 실패로 돌린다.
    if (flaggedUnsafe(data)) throw new SafetyBlockedError("fal");
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

        const prompt = [
          `A character design sheet for a 2D Korean webcomic manhwa character '${req.name}', soft line art style.`,
          `Art Style: soft line art, ${stylePrompt}, clean ink lineart, flat solid cel shading with crisp hard shadow boundaries, zero gradients, clean digital webcomic aesthetic.`,
          `[Body & Anatomy]: Realistic 6.5 to 7.0 heads tall natural adult proportions, anatomically correct Korean manhwa anatomy, natural limb lengths, normal head-to-body ratio, strictly NO chibi, NO super-deformed (SD) style, NO oversized head.`,
          `[Facial Proportions]: Delicate, proportionate Korean manhwa facial features, natural eye size fitting modern webtoon aesthetics (NOT oversized bug-eyes, NOT chibi doll eyes), well-defined jawline, refined small nose, natural lips, mature young adult face structure.`,
          `View & Pose: ${viewDesc}.`,
          `Background: pure solid flat white background (#FFFFFF), neutral flat high-key studio lighting, strictly NO background elements, NO room, NO furniture, NO shadows on floor, isolated character model reference sheet.`,
          `[Character Appearance]: Korean human character '${req.name}' with natural human ears (STRICTLY NO animal ears, NO headband, NO costume, NO tail). ${descPrompt ? `Appearance description: ${descPrompt}.` : "Natural neat hairstyle and clean casual outfit."} ${tagsPrompt ? `Style tags: ${tagsPrompt}.` : ""}`,
          descPrompt,
          tagsPrompt,
          `Strict Requirements: Clean 2D outline drawing, flat solid cel shading, pure white background, consistent 6.5-head adult proportions, pure textless model reference.`,
        ]
          .filter(Boolean)
          .join("\n");

        console.log(`\n🎨 [FLUX Sheet View: ${view}] Prompt:\n${prompt}\n`);

        const seed = (getEpisodeSeed(req.name, idx + 1) + idx * 101) % 2147483647;

        const sheetLoras = [
          {
            path: "alvdansen/soft-line-flux",
            scale: 0.75,
          },
        ];

        const body: Record<string, unknown> = {
          prompt,
          image_size: { width: 1024, height: 1024 },
          num_inference_steps: this.variant === "schnell" ? 4 : 28,
          num_images: 1,
          seed,
          enable_safety_checker: true,
          loras: sheetLoras,
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
          throw new Error(`캐릭터 뷰(${CHARACTER_SHEET_LABEL[view]}) 생성 실패: ${res.status} - ${errText}`);
        }

        const data = await res.json();
        if (flaggedUnsafe(data)) throw new SafetyBlockedError("fal", "캐릭터 시트가 이미지 안전 검사에 걸렸어요. 특징 태그를 바꿔 다시 만들어 주세요.");
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
    return false;
  }
}

/** fal 응답의 안전 검사 결과. 이미지마다 true/false 배열이다(엔드포인트에 따라 없을 수 있다). */
function flaggedUnsafe(data: { has_nsfw_concepts?: unknown }): boolean {
  return Array.isArray(data.has_nsfw_concepts) && data.has_nsfw_concepts.some(Boolean);
}

