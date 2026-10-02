/**
 * 이미지 생성기 선택 — 오너: 웅싯(A).
 *
 * 파이프라인은 이 함수만 부른다. 오픈 이슈 1 이 끝나면 여기서 실제 구현으로 갈아탄다.
 */

import type { ImageGenerator } from "@/contracts/generation";
import { processSingleton } from "@/lib/singleton";
import { MockImageGenerator } from "./mock";

export function getImageGenerator(): ImageGenerator {
  // 목 생성기는 "한 번 실패한 컷" 기억을 들고 있어야 재시도가 성공한다.
  // 액션과 라우트가 같은 기억을 보도록 프로세스에 하나만 둔다.
  return processSingleton("image-generator", () => new MockImageGenerator());
}

export function usingMockGenerator(): boolean {
  return getImageGenerator() instanceof MockImageGenerator;
}
