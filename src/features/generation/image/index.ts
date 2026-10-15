/**
 * 이미지 생성기 선택
 *
 * 환경변수 SHARKTOON_IMAGE_PROVIDER 또는 등록된 키에 따라 생성기를 선택합니다.
 * - "openai" / "gpt-image-2": OpenAI gpt-image-2 (멀티 레퍼런스 에디트 및 코덱스 불변식 하네스)
 * - "comfyui" / "fal-comfy": ComfyUI 3단계 워크플로우 (ControlNet + Regional Prompting + PuLID + LoRA)
 * - "fal-dev": Fal.ai Flux.1 dev (고품질)
 * - "fal-schnell": Fal.ai Flux.1 schnell (초저가·초고속)
 * - "google": Google AI Studio Imagen 3
 * - "mock": 개발용 자리표시 목 생성기 (기본값)
 */

import type { GenerationTier, ImageGenerator } from "@/contracts/generation";
import { processSingleton } from "@/lib/singleton";
import { ComfyUIGenerator } from "./comfy";
import { FalFluxGenerator } from "./fal";
import { GoogleImagenGenerator } from "./google";
import { MockImageGenerator } from "./mock";
import { OpenAIImageGenerator } from "./openai";

export { OpenAIImageGenerator } from "./openai";
export { ComfyUIGenerator } from "./comfy";
export { FalFluxGenerator } from "./fal";
export { GoogleImagenGenerator } from "./google";

export function getImageGenerator(tier?: GenerationTier): ImageGenerator {
  const isCheckScript = process.argv.some((arg) => arg.includes("generation-check"));
  const provider = isCheckScript ? "mock" : (process.env.SHARKTOON_IMAGE_PROVIDER ?? "").toLowerCase().trim();

  if (provider === "mock") {
    return processSingleton("image-generator-mock", () => new MockImageGenerator());
  }

  // 1. Tier 가 명시적으로 주어진 경우
  if (tier === "standard") {
    if (provider === "openai" || provider.includes("gpt-image")) {
      return new OpenAIImageGenerator("gpt-image-2.5-flare", "medium");
    }
    if (provider === "google") return new GoogleImagenGenerator();
    if (process.env.FAL_KEY || process.env.FAL_API_KEY || provider === "fal" || provider === "fal-schnell") {
      return new FalFluxGenerator("schnell");
    }
  }

  if (tier === "pro") {
    if (provider === "openai" || provider.includes("gpt-image")) {
      return new OpenAIImageGenerator("gpt-image-2.5-sunburst", "high");
    }
    if (provider === "google") return new GoogleImagenGenerator();
    return new ComfyUIGenerator();
  }


  // 2. 환경변수 지정 생성기
  if (provider === "openai" || provider === "gpt-image-2") {
    return new OpenAIImageGenerator(undefined, "medium");
  }
  if (provider === "comfyui" || provider === "comfy" || provider === "fal-comfy") {
    return new ComfyUIGenerator();
  }
  if (provider === "google") {
    return new GoogleImagenGenerator();
  }
  if (provider === "fal-schnell" || provider === "fal") {
    return new FalFluxGenerator("schnell");
  }
  if (provider === "fal-dev") {
    return new FalFluxGenerator("dev");
  }

  // 3. 명시적 provider가 없을 때 등록된 키 우선순위로 자동 선택
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIImageGenerator(undefined, "medium");
  }

  if (process.env.FAL_KEY || process.env.FAL_API_KEY) {
    return tier === "standard" ? new FalFluxGenerator("schnell") : new ComfyUIGenerator();
  }
  if (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    return new GoogleImagenGenerator();
  }

  return processSingleton("image-generator-mock", () => new MockImageGenerator());
}

export function usingMockGenerator(): boolean {
  return getImageGenerator() instanceof MockImageGenerator;
}
