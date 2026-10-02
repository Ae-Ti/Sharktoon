/**
 * 캐러셀 내보내기 — PRD 4.1 "캐러셀 이미지는 1:1 또는 4:5 비율로 ZIP 내보내기".
 *
 * 브라우저에서 레이어 트리를 원본 배율(1080 폭)로 다시 그려 PNG 로 뽑는다. 편집 캔버스와
 * 같은 노드 설정(nodeConfig)을 쓰므로 화면에서 본 것과 같다. 서버로 이미지를 보내지 않는다.
 *
 * - 모든 PNG 에 AI 생성 메타데이터를 남긴다(콘텐츠 안전 정책, 오픈 이슈 7 의 1차안).
 * - 무료 요금제는 워터마크를 넣는다(요금제 정책).
 */

import Konva from "konva";
import { zipSync } from "fflate";
import { isVectorTextLayer, type CutLayerTree } from "../types/layer";
import { ensureToonFont } from "./fonts";
import { bodyConfig, tailConfigs, textConfig } from "./nodeConfig";
import { withAiMetadata } from "./pngMeta";

export type ExportRatio = "1:1" | "4:5";

export const EXPORT_SIZE: Record<ExportRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export interface ExportOptions {
  ratio: ExportRatio;
  watermark: boolean;
}

/** 컷 하나를 PNG 바이트로. */
export async function renderCutPng(tree: CutLayerTree, options: ExportOptions): Promise<Uint8Array> {
  const native = await renderTree(tree);
  const framed = frame(native, options);
  const blob = await new Promise<Blob>((resolve, reject) =>
    framed.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 를 만들지 못했어요"))), "image/png"),
  );
  return withAiMetadata(new Uint8Array(await blob.arrayBuffer()));
}

/** 컷들을 순서대로 01.png, 02.png … 로 묶은 ZIP. */
export async function exportCarouselZip(
  trees: CutLayerTree[],
  options: ExportOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  for (const [i, tree] of trees.entries()) {
    files[`${String(i + 1).padStart(2, "0")}.png`] = await renderCutPng(tree, options);
    onProgress?.(i + 1, trees.length);
  }
  // PNG 는 이미 압축돼 있다. 다시 압축하면 시간만 든다.
  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped.slice().buffer], { type: "application/zip" });
}

async function renderTree(tree: CutLayerTree): Promise<HTMLCanvasElement> {
  const families = new Set(tree.layers.filter(isVectorTextLayer).map((l) => l.style.fontFamily));
  await Promise.all([...families].map(ensureToonFont));

  const container = document.createElement("div");
  const stage = new Konva.Stage({ container, width: tree.canvas.width, height: tree.canvas.height });
  const layer = new Konva.Layer();
  stage.add(layer);

  // 흰 바탕. 투명 PNG 를 인스타에 올리면 검게 보인다.
  layer.add(new Konva.Rect({ x: 0, y: 0, width: tree.canvas.width, height: tree.canvas.height, fill: "#ffffff" }));

  for (const l of tree.layers) {
    if (l.hidden) continue;
    if (isVectorTextLayer(l)) {
      const body = bodyConfig(l);
      if (body) layer.add(new Konva.Rect(body));
      const tail = tailConfigs(l);
      if (tail?.kind === "wedge") {
        layer.add(new Konva.Line(tail.fill));
        layer.add(new Konva.Line(tail.outline));
      } else if (tail?.kind === "bubbles") {
        for (const c of tail.circles) layer.add(new Konva.Circle(c));
      }
      layer.add(new Konva.Text(textConfig(l) as Konva.TextConfig));
    } else if (l.imageUrl) {
      const image = await loadImage(l.imageUrl);
      layer.add(
        new Konva.Image({
          image,
          x: l.box.x,
          y: l.box.y,
          width: l.box.width,
          height: l.box.height,
          rotation: l.box.rotation ?? 0,
          opacity: l.opacity ?? 1,
        }),
      );
    }
  }

  layer.draw();
  const canvas = stage.toCanvas({ pixelRatio: 1 });
  stage.destroy();
  return canvas;
}

/** 원본 비율과 내보낼 비율이 다르면 흰 여백을 두고 가운데 맞춘다. 자르지 않는다. */
function frame(source: HTMLCanvasElement, { ratio, watermark }: ExportOptions): HTMLCanvasElement {
  const { width, height } = EXPORT_SIZE[ratio];
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const s = Math.min(width / source.width, height / source.height);
  const w = source.width * s;
  const h = source.height * s;
  ctx.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);

  if (watermark) {
    // 오른쪽 아래, 대사와 겹치지 않는 자리에 작게.
    ctx.font = "700 28px Pretendard, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.fillStyle = "rgba(18,24,32,0.55)";
    ctx.strokeText("샥툰으로 만듦", width - 24, height - 20);
    ctx.fillText("샥툰으로 만듦", width - 24, height - 20);
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // 서명 URL(Storage) 은 교차 출처다. CORS 를 통과해야 캔버스를 PNG 로 뽑을 수 있다.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("컷 이미지를 불러오지 못했어요. 새로고침 뒤 다시 시도해 주세요."));
    img.src = src;
  });
}
