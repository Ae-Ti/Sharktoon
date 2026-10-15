/**
 * OpenAI Image Generator (gpt-image-2)
 *
 * OpenAI의 최신 고화질 이미지 생성 및 멀티 레퍼런스 편집 모델인 `gpt-image-2`를 사용하여
 * 컷 및 캐릭터 시트를 생성합니다.
 *
 * 특징:
 * - 멀티 레퍼런스 입력 시 자동 High-Fidelity 적용 (인물 외모, 화풍, 스타일 유지력 극대화)
 * - 코덱스(Codex) 스타일의 구조화된 프롬프트 스캐폴딩 및 Invariants(불변 규칙) 강제
 * - 1:1 (1024x1024) 및 4:5 (1024x1280) 최적 해상도 지원
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
import { buildStructuredWebtoonPrompt } from "./promptBuilder";

const OPENAI_API_HOST = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-image-2";

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  return key;
}

/**
 * 한국어 씬 지문을 OpenAI gpt-4o-mini를 통해 고품질 영문 비주얼 묘사로 변환
 */
async function translateKoreanToVisualEnglish(text: string, apiKey: string): Promise<string> {
  const cleaned = text
    .replace(/말풍선[^\n/]*/g, "")
    .replace(/대사[^\n/]*/g, "")
    .replace(/나레이션[^\n/]*/g, "")
    .replace(/글자[^\n/]*/g, "")
    .replace(/자막[^\n/]*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(cleaned)) return cleaned;

  try {
    const res = await fetch(`${OPENAI_API_HOST}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert visual prompt engineer for Korean 2D webcomics and manhwa. Translate the given Korean scene description into concise, dynamic visual English for AI image generation. Emphasize physical character actions, comical expressions, prop interactions, and environmental lighting. Strictly exclude all dialogue, speech bubbles, sound effects, or textual elements.",
          },
          { role: "user", content: cleaned },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    }
  } catch (e) {
    console.warn("OpenAI visual prompt translation fallback:", e);
  }

  return cleaned;
}

/**
 * URL 또는 data URI를 Blob으로 변환
 */
async function resolveImageToBlob(urlOrDataUri: string): Promise<Blob | null> {
  try {
    if (urlOrDataUri.startsWith("data:")) {
      const match = urlOrDataUri.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      const mime = match[1];
      const buffer = Buffer.from(match[2], "base64");
      return new Blob([buffer], { type: mime });
    }
    const res = await fetch(urlOrDataUri);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";
    return new Blob([arrayBuffer], { type: contentType });
  } catch (e) {
    console.warn("Failed to resolve reference image to Blob:", e);
    return null;
  }
}

export class OpenAIImageGenerator implements ImageGenerator {
  private modelName: string;
  private quality: "low" | "medium" | "high" | "auto";

  constructor(modelName?: string, quality: "low" | "medium" | "high" | "auto" = "medium") {
    this.modelName = modelName || process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
    this.quality = quality;
  }

  supportsInpainting(): boolean {
    return true;
  }

  async generateCut(req: CutGenerationRequest): Promise<CutGenerationResult> {
    const apiKey = getApiKey();
    const is4to5 = req.seriesRule?.aspectRatio === "4:5";
    // gpt-image-2 해상도: 1:1은 1024x1024, 4:5는 1024x1280 (16의 배수이자 655k..8.3M 픽셀 조건 만족)
    const size = is4to5 ? "1024x1280" : "1024x1024";

    // 1. 한국어 씬 지문 비주얼 영문 변환
    const visualScene = await translateKoreanToVisualEnglish(req.prompt, apiKey);

    // 2. 코덱스 스타일 스캐폴딩 및 Invariant(불변 규칙) 프롬프트 빌드
    const structured = buildStructuredWebtoonPrompt({
      cutIndex: req.index,
      cutText: req.prompt,
      visualScene,
      stylePreset: String(req.seriesRule?.stylePreset ?? "심플 라인"),
    });

    const prompt = structured.prompt;

    // 3. 고정 레퍼런스 이미지 추출 (캐릭터 시트 및 시리즈 에셋)
    const rawRefUrl = req.characterSheetRefs?.[0] || req.assetRefs?.[0];
    const isRasterRef = Boolean(
      rawRefUrl &&
      !rawRefUrl.startsWith("data:image/svg") &&
      !rawRefUrl.endsWith(".svg"),
    );

    let referenceBlob: Blob | null = null;
    if (isRasterRef && rawRefUrl && !req.skipFaceLock) {
      referenceBlob = await resolveImageToBlob(rawRefUrl);
    }

    console.log(`\n🤖 [OpenAI ${this.modelName} Cut ${req.index}] Final Prompt:\n${prompt}\n`);
    if (referenceBlob) {
      console.log(`🖼️ [OpenAI ${this.modelName} Cut ${req.index}] Attaching Reference Image: ${referenceBlob.size} bytes`);
    }

    let imageUrl: string;

    // 레퍼런스 이미지가 제공되고 edits가 가능한 경우 /v1/images/edits 호출 (멀티 레퍼런스 기반 일관성 락)
    if (referenceBlob) {
      try {
        const formData = new FormData();
        formData.append("model", this.modelName);
        formData.append("prompt", prompt);
        formData.append("size", size);
        formData.append("quality", this.quality);
        formData.append("output_format", "png");
        formData.append("image", referenceBlob, "character_reference.png");

        if (req.maskUrl) {
          const maskBlob = await resolveImageToBlob(req.maskUrl);
          if (maskBlob) {
            formData.append("mask", maskBlob, "mask.png");
          }
        }

        const res = await fetch(`${OPENAI_API_HOST}/images/edits`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`OpenAI /images/edits failed (${res.status}): ${errText}. Falling back to /images/generations...`);
          imageUrl = await this.fallbackGenerations(prompt, size, apiKey);
        } else {
          const data = await res.json();
          imageUrl = this.extractImageUrl(data);
        }
      } catch (e) {
        console.warn("OpenAI edits error, falling back to generations:", e);
        imageUrl = await this.fallbackGenerations(prompt, size, apiKey);
      }
    } else {
      // 레퍼런스가 없거나 신규 컷 생성인 경우 /v1/images/generations 호출
      imageUrl = await this.fallbackGenerations(prompt, size, apiKey);
    }

    return {
      cutId: req.cutId,
      imageUrl,
      metadata: {
        model: this.modelName,
        generatedAt: new Date().toISOString(),
        aiGenerated: true,
      },
    };
  }

  private async fallbackGenerations(prompt: string, size: string, apiKey: string): Promise<string> {
    const res = await fetch(`${OPENAI_API_HOST}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelName,
        prompt,
        size,
        quality: this.quality,
        n: 1,
        output_format: "png",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI 이미지 생성 실패 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return this.extractImageUrl(data);
  }

  private extractImageUrl(data: { data?: { b64_json?: string; url?: string }[] }): string {
    const item = data.data?.[0];
    if (item?.b64_json) {
      return `data:image/png;base64,${item.b64_json}`;
    }
    if (item?.url) {
      return item.url;
    }
    throw new Error("OpenAI 응답에 이미지 데이터가 없습니다.");
  }

  async generateCharacterSheet(req: CharacterSheetRequest): Promise<CharacterSheetResult> {
    const apiKey = getApiKey();
    const stylePrompt = req.style || "심플 라인";

    const views = await Promise.all(
      CHARACTER_SHEET_VIEWS.map(async (view) => {
        const viewLabel = CHARACTER_SHEET_LABEL[view];
        const prompt = [
          `[USE CASE & MEDIUM]: Korean 2D webtoon character reference sheet, clean animation model sheet.`,
          `[CHARACTER SPECIFICATION]: Name: ${req.name}. Features: ${req.tags?.join(", ") ?? "neat short black hair"}. ${req.description ?? ""}`,
          `[VIEW & POSE]: Character model sheet view: ${viewLabel} angle. Isolated character on clean minimalist solid neutral background.`,
          `[ART DIRECTION & STYLE]: Clean 2D Korean webtoon manhwa style, uniform 1.8px black contour lineart, flat solid cel shading, zero gradients, zero 3D rendering. Style preset: ${stylePrompt}.`,
          `[STRICT INVARIANTS]: Maintain strictly identical face shape, hairstyle, eyes, facial proportions, and signature costume across all views. Textless illustration.`,
        ].join("\n");

        const imageUrl = await this.fallbackGenerations(prompt, "1024x1024", apiKey);
        return { view, imageUrl };
      }),
    );

    return {
      views,
      metadata: {
        model: this.modelName,
        generatedAt: new Date().toISOString(),
        aiGenerated: true,
      },
    };
  }
}
