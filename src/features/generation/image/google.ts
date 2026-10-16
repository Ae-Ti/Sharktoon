/**
 * Google AI Studio (Imagen 3) 이미지 생성기
 *
 * Google AI Studio API 키를 사용하여 컷 및 캐릭터 시트를 생성합니다.
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

const GOOGLE_API_HOST = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(): string {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GOOGLE_AI_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  return key;
}

function resolveStylePrompt(style?: string): string {
  switch (style) {
    case "파스텔":
    case "pastel":
      return "soft pastel colors, cozy warm 2D manhwa webtoon style, cute illustration";
    case "굵은 선":
    case "bold_line":
      return "bold ink outlines, expressive 2D comic art, vibrant colors, korean webtoon style";
    case "심플 라인":
    case "simple_line":
    default:
      return "clean line art, simple 2D korean webtoon style, flat color, cute character design";
  }
}

import { buildStructuredWebtoonPrompt } from "./promptBuilder";

export class GoogleImagenGenerator implements ImageGenerator {
  private modelName: string;

  constructor(modelName = "imagen-3.0-generate-002") {
    this.modelName = modelName;
  }

  async generateCut(req: CutGenerationRequest): Promise<CutGenerationResult> {
    const apiKey = getApiKey();
    const aspectRatio = req.seriesRule?.aspectRatio === "4:5" ? "3:4" : "1:1";

    const requestMatch = req.prompt.match(/요청:\s*([^\n]+)/);
    const customRequest = requestMatch ? requestMatch[1].trim() : undefined;

    const rawTraits = Array.isArray(req.seriesRule?.characterTraits)
      ? (req.seriesRule.characterTraits as string[]).filter(Boolean)
      : [];
    const cutText = req.prompt;
    const matchedTraits = rawTraits.filter((trait) => {
      const parts = trait.split(/[·,]/).map((s) => s.trim()).filter(Boolean);
      return parts.some((p) => p.length >= 2 && cutText.includes(p));
    });
    const activeTraits = matchedTraits.length > 0 ? matchedTraits : rawTraits;
    const characterAppearance = activeTraits.length > 0 ? activeTraits.join(", ") : "";

    const structured = buildStructuredWebtoonPrompt({
      cutIndex: req.index,
      cutText: req.prompt,
      visualScene: req.prompt,
      stylePreset: String(req.seriesRule?.stylePreset ?? "심플 라인"),
      characterAppearance,
      intent: req.intent,
      customRequest,
    });
    const prompt = structured.prompt;


    const endpoint = `${GOOGLE_API_HOST}/models/${this.modelName}:predict?key=${apiKey}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
          personGeneration: "ALLOW_ADULT",
          outputMimeType: "image/jpeg",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Imagen API 실패 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const prediction = data.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      throw new Error("Google Imagen 응답에 이미지 데이터가 없습니다.");
    }

    const mimeType = prediction.mimeType || "image/jpeg";
    const imageUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;

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

  async generateCharacterSheet(req: CharacterSheetRequest): Promise<CharacterSheetResult> {
    const apiKey = getApiKey();
    const stylePrompt = resolveStylePrompt(req.style);
    const tagsPrompt = req.tags?.length ? `Tags: ${req.tags.join(", ")}.` : "";
    const descPrompt = req.description ? `Description: ${req.description}.` : "";

    const views = await Promise.all(
      CHARACTER_SHEET_VIEWS.map(async (view) => {
        let viewDesc = "";
        switch (view) {
          case "front":
            viewDesc = "front view, neutral standing pose";
            break;
          case "side":
            viewDesc = "side profile view, standing pose";
            break;
          case "expression_joy":
            viewDesc = "close-up face portrait, joyous happy smiling expression";
            break;
          case "expression_sad":
            viewDesc = "close-up face portrait, sad crying gloomy expression";
            break;
          case "expression_angry":
            viewDesc = "close-up face portrait, angry upset fierce expression";
            break;
          case "expression_surprised":
            viewDesc = "close-up face portrait, surprised shocked wide eyes expression";
            break;
          case "full_body":
            viewDesc = "full body view, cheerful casual pose";
            break;
        }

        const prompt = [
          `Character design sheet for korean webtoon character named '${req.name}'.`,
          viewDesc,
          stylePrompt,
          tagsPrompt,
          descPrompt,
          "clean white background, 2D manhwa vector art, character reference, no text, no watermarks",
        ]
          .filter(Boolean)
          .join(", ");

        const endpoint = `${GOOGLE_API_HOST}/models/${this.modelName}:predict?key=${apiKey}`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "1:1",
              personGeneration: "ALLOW_ADULT",
              outputMimeType: "image/jpeg",
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`캐릭터 뷰(${CHARACTER_SHEET_LABEL[view]}) 생성 실패: ${res.status}`);
        }

        const data = await res.json();
        const pred = data.predictions?.[0];
        const mimeType = pred?.mimeType || "image/jpeg";
        return {
          view,
          imageUrl: `data:${mimeType};base64,${pred.bytesBase64Encoded}`,
        };
      })
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

  supportsInpainting(): boolean {
    return false;
  }
}
