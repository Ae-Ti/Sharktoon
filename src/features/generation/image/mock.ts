/**
 * 목 이미지 생성기 — 오픈 이슈 1(1차 모델 선정)이 끝나기 전까지의 대역.
 *
 * `ImageGenerator` 뒤에 있으므로 모델이 정해지면 이 파일을 쓰지 않게만 하면 된다.
 * 파이프라인·큐·환불·화면은 이 구현으로 전부 완성할 수 있다.
 */

import type {
  CutGenerationRequest,
  CutGenerationResult,
  ImageGenerator,
} from "@/contracts/generation";
import { mockCutImageUrl } from "../mocks/cutImage";

/** 실제 모델이 컷 하나에 쓰는 시간대. 화면의 진행률이 그럴듯하게 보이는 정도. */
const MIN_MS = 1200;
const MAX_MS = 2600;

/**
 * 첫 시도에서 실패시킬 컷 번호. 실패·환불·재시도 경로를 눈으로 볼 수 있어야
 * 그 화면이 제대로 만들어졌는지 알 수 있다. 끄려면 빈 문자열을 넣는다.
 */
const FAIL_CUTS = (process.env.SHARKTOON_MOCK_FAIL_CUTS ?? "4")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));

export class MockImageGenerator implements ImageGenerator {
  /** 이미 한 번 실패시킨 컷. 재시도는 성공시킨다. */
  private failedOnce = new Set<string>();

  async generateCut(req: CutGenerationRequest): Promise<CutGenerationResult> {
    await sleep(MIN_MS + Math.random() * (MAX_MS - MIN_MS));

    const cutNumber = cutNumberOf(req.cutId);
    if (cutNumber != null && FAIL_CUTS.includes(cutNumber) && !this.failedOnce.has(req.cutId)) {
      this.failedOnce.add(req.cutId);
      throw new Error("안전 필터에 걸려 이미지를 못 만들었어요");
    }

    return {
      cutId: req.cutId,
      imageUrl: mockCutImageUrl(cutNumber ?? 1, req.prompt.slice(0, 18)),
      metadata: {
        model: "mock-image-generator",
        generatedAt: new Date().toISOString(),
        aiGenerated: true,
      },
    };
  }

  /** 오픈 이슈 3 이 끝나기 전까지는 꺼 둔다. 화면이 이 값으로 부분 재생성 UI 를 감춘다. */
  supportsInpainting(): boolean {
    return false;
  }
}

/** cut_3 → 3. 목 이미지의 번호와 실패 컷 판정에만 쓴다. */
function cutNumberOf(cutId: string): number | null {
  const m = /(\d+)$/.exec(cutId);
  return m ? Number(m[1]) : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
