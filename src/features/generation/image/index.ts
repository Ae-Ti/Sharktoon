/**
 * 이미지 생성기 선택
 *
 * 환경변수 SHARKTOON_IMAGE_PROVIDER 또는 등록된 키에 따라 생성기를 선택합니다.
 * - "comfyui" / "fal-comfy": ComfyUI 3단계 워크플로우 (ControlNet + Regional Prompting + PuLID + LoRA)
 * - "fal-dev": Fal.ai Flux.1 dev (고품질)
 * - "fal-schnell": Fal.ai Flux.1 schnell (초저가·초고속)
 * - "google": Google AI Studio Imagen 3
 * - "mock": 개발용 자리표시 목 생성기 (기본값)
 */

import type { ImageGenerator } from "@/contracts/generation";
import { processSingleton } from "@/lib/singleton";
import { ComfyUIGenerator } from "./comfy";
import { FalFluxGenerator } from "./fal";
import { GoogleImagenGenerator } from "./google";
import { MockImageGenerator } from "./mock";

export function getImageGenerator(): ImageGenerator {
  const isCheckScript = process.argv.some((arg) => arg.includes("generation-check"));
  const provider = isCheckScript ? "mock" : (process.env.SHARKTOON_IMAGE_PROVIDER ?? "").toLowerCase().trim();

  if (provider === "mock") {
    return processSingleton("image-generator-mock", () => new MockImageGenerator());
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

  // 명시적 provider가 없을 때 등록된 키 우선순위로 자동 선택
  if (process.env.FAL_KEY || process.env.FAL_API_KEY) {
    return new FalFluxGenerator("dev");
  }
  if (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    return new GoogleImagenGenerator();
  }

  return processSingleton("image-generator-mock", () => new MockImageGenerator());
}

export function usingMockGenerator(): boolean {
  return getImageGenerator() instanceof MockImageGenerator;
}
