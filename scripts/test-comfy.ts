/**
 * ComfyUI 워크플로우 그래프 생성 및 생성기 동작 검증 스크립트
 */

import { buildComfyWebtoonWorkflow, ComfyUIGenerator } from "../src/features/generation/image/comfy";
import type { CutGenerationRequest } from "../src/contracts/generation";

function runVerification() {
  console.log("=== 1. ComfyUI 노드 그래프 빌더 검증 ===");
  const graph = buildComfyWebtoonWorkflow({
    positivePrompt: "A single panel from a 2D Korean webcomic manhwa, soft line art style",
    negativePrompt: "chibi, low quality",
    characterSheetUrl: "https://example.com/character.png",
    regionalLeftPrompt: "Male veterinarian in white lab coat examining cat",
    regionalRightPrompt: "Female protagonist in dark hoodie watching",
    posePreset: "standing",
    width: 1024,
    height: 1024,
    seed: 12345,
    steps: 28,
    cfg: 3.8,
    idWeight: 0.75,
    loraScale: 0.75,
  });

  const nodeIds = Object.keys(graph);
  console.log(`생성된 노드 개수: ${nodeIds.length}`);

  // 핵심 노드 존재 검증
  const expectedNodes = [
    { id: "1", type: "CheckpointLoaderSimple" },
    { id: "2", type: "LoraLoader" },
    { id: "3", type: "LoadImage" },
    { id: "4", type: "ApplyPuLID" },
    { id: "5", type: "CLIPTextEncode" },
    { id: "6", type: "CLIPTextEncode" },
    { id: "7", type: "CLIPTextEncode" },
    { id: "8", type: "ConditioningSetArea" },
    { id: "9", type: "CLIPTextEncode" },
    { id: "10", type: "ConditioningSetArea" },
    { id: "11", type: "ConditioningCombine" },
    { id: "12", type: "ConditioningCombine" },
    { id: "13", type: "ControlNetLoader" },
    { id: "14", type: "LoadImage" },
    { id: "15", type: "ApplyControlNet" },
    { id: "16", type: "EmptyLatentImage" },
    { id: "17", type: "KSampler" },
    { id: "18", type: "VAEDecode" },
    { id: "19", type: "SaveImage" },
  ];

  for (const exp of expectedNodes) {
    if (!graph[exp.id]) {
      throw new Error(`노드 ${exp.id} 누락!`);
    }
    if (graph[exp.id].class_type !== exp.type) {
      throw new Error(`노드 ${exp.id}의 class_type 불일치: ${graph[exp.id].class_type} !== ${exp.type}`);
    }
  }

  console.log("✅ 19개 핵심 ComfyUI 노드 생성 및 연결 검증 완료!");

  // 노드 링크 무결성 검사: 모든 [nodeId, outputIdx] 링크가 실제 존재하는 노드를 가리키는지 확인
  for (const [id, node] of Object.entries(graph)) {
    for (const [k, v] of Object.entries(node.inputs)) {
      if (Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "number") {
        const targetNodeId = v[0];
        if (!graph[targetNodeId]) {
          throw new Error(`노드 ${id}의 input [${k}]가 존재하지 않는 노드 ${targetNodeId}를 참조하고 있습니다.`);
        }
      }
    }
  }

  console.log("✅ 모든 노드 간 의존성/링크 무결성 100% 검증 통과!");

  console.log("\n=== 2. ComfyUIGenerator 인스턴스 검증 ===");
  const generator = new ComfyUIGenerator();
  if (!generator.supportsInpainting()) {
    throw new Error("ComfyUIGenerator는 inpainting을 지원해야 합니다.");
  }
  console.log("✅ ComfyUIGenerator supportsInpainting: true");
  console.log("✅ 모든 테스트 성공 완료!\n");
}

runVerification();
