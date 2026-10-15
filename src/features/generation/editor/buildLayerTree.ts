/**
 * 처음 여는 컷의 레이어 트리 — 생성 이미지 위에 콘티의 대사·나레이션·후킹·CTA 를
 * 벡터 레이어로 얹는다. 글자는 이미지에 굽지 않는다(PRD 3.2).
 *
 * 한 번 저장되면 그 뒤로는 저장된 트리를 쓴다. 이미지 URL 은 서명 URL 이라
 * 저장하지 않으므로, 열 때마다 `hydrateLayerTree` 로 다시 붙인다.
 */

import type { CutLayerTree, ImageLayer, Layer, VectorTextLayer } from "../types/layer";
import { characterName, type Storyboard, type StoryboardCut } from "../types/storyboard";
import { DEFAULT_TOON_FONT } from "./fonts";

export const CANVAS_WIDTH = 1080;

/** 인스타 캐러셀 규격. 1:1 은 1080×1080, 4:5 는 1080×1350. */
export function canvasFor(aspectRatio: "1:1" | "4:5") {
  return { width: CANVAS_WIDTH, height: aspectRatio === "4:5" ? 1350 : 1080 };
}

const INK = "#121820";

export function buildLayerTree(input: {
  storyboard: Storyboard;
  cut: StoryboardCut;
  imageUrl: string;
  aspectRatio: "1:1" | "4:5";
}): CutLayerTree {
  const { storyboard, cut } = input;
  const canvas = canvasFor(input.aspectRatio);
  const W = canvas.width;
  const H = canvas.height;
  const isFirst = cut.index === 1;
  const isLast = cut.index === storyboard.cuts.length;

  const layers: Layer[] = [];

  const background: ImageLayer = {
    id: `ly_bg_${cut.id}`,
    name: "배경 · 생성 이미지",
    kind: "background",
    box: { x: 0, y: 0, width: W, height: H },
    // 배경을 실수로 끄는 일이 제일 잦다. 기본 잠금(캔버스 규칙).
    locked: true,
    imageUrl: input.imageUrl,
    sourceCutId: cut.id,
  };
  layers.push(background);

  let top = 60;
  const isCover = cut.isCover === true;
  const hook = (isFirst || isCover)
    ? storyboard.hookOptions.find((h) => h.id === storyboard.selectedHookId)?.text
    : undefined;
  if (hook) {
    layers.push(textLayer({
      id: `ly_hook_${cut.id}`,
      name: isCover ? "표지 타이틀" : "후킹",
      kind: "text",
      text: hook,
      box: { x: 60, y: top, width: W - 120, height: isCover ? 180 : 150 },
      fontSize: isCover ? 64 : 56,
      bold: true,
      stroke: true,
    }));
    top += isCover ? 220 : 190;
  }

  // 스마트 대사 배치: 화자 및 인물 위치(좌/우/반려동물)를 감지하여 얼굴 가림 방지 및 꼬리 방향 자동 조절
  cut.dialogue.forEach((line, i) => {
    const speaker = (line.speakerId || "").toLowerCase();
    const isSecondary = speaker.includes("vet") || speaker.includes("doctor") || speaker.includes("boss") || speaker.includes("의사");
    const isPet = speaker.includes("cat") || speaker.includes("고양이") || speaker.includes("반려");

    // 조연은 좌측, 주인공은 우측(다중 대사 시 엇갈림)
    let left = i % 2 === 0;
    if (isSecondary) {
      left = true;
    } else if (speaker.includes("me") || speaker.includes("나")) {
      left = false;
    }

    const boxWidth = Math.min(480, W - 140);
    const box = {
      x: left ? 70 : W - 70 - boxWidth,
      y: top + i * 190,
      width: boxWidth,
      height: 160,
    };

    if (line.balloon === "narration_box" || (!line.speakerId && line.balloon !== "none")) {
      layers.push({
        ...textLayer({
          id: `ly_line_${line.id}`,
          name: "나레이션 박스",
          kind: "narration",
          text: line.text,
          box: { x: 60, y: top + i * 140, width: W - 120, height: 110 },
          fontSize: 36,
          align: "left",
        }),
        balloon: "narration_box",
        overridesSeriesStyle: false,
      });
      return;
    }

    if (line.balloon === "none") {
      layers.push(textLayer({
        id: `ly_line_${line.id}`,
        name: `효과음 "${line.text.slice(0, 6)}"`,
        kind: "sfx",
        text: line.text,
        box: { ...box, rotation: left ? -6 : 6 },
        fontSize: 72,
        bold: true,
        stroke: true,
      }));
      return;
    }

    // 꼬리 위치: 좌측 화자는 좌하단, 우측 화자는 우하단, 동물은 중앙 아래로 자연스럽게 지향
    const tailX = isPet
      ? box.x + box.width / 2
      : left
        ? box.x + 100
        : box.x + box.width - 100;
    const tailY = box.y + box.height + 115;

    layers.push({
      ...textLayer({
        id: `ly_line_${line.id}`,
        name: `말풍선 · ${characterName(storyboard, line.speakerId)}`,
        kind: "balloon",
        text: line.text,
        box,
        fontSize: 40,
      }),
      balloon: line.balloon,
      tail: { x: tailX, y: tailY },
    });
  });

  let bottom = H - 60;
  if (cut.narration && !cut.dialogue.some((d) => !d.speakerId || d.balloon === "narration_box")) {
    bottom -= 110;
    layers.push({
      ...textLayer({
        id: `ly_narr_${cut.id}`,
        name: "나레이션 박스",
        kind: "narration",
        text: cut.narration,
        box: { x: 60, y: bottom, width: W - 120, height: 110 },
        fontSize: 36,
        align: "left",
      }),
      balloon: "narration_box",
      // 시리즈 기본 스타일을 그대로 쓴다. 컷에서 덮어쓰면 true 가 된다.
      overridesSeriesStyle: false,
    });
    bottom -= 30;
  }

  const cta = isLast
    ? storyboard.ctaOptions.find((c) => c.id === storyboard.selectedCtaId)?.text
    : undefined;
  if (cta) {
    layers.push(textLayer({
      id: `ly_cta_${cut.id}`,
      name: "CTA",
      kind: "text",
      text: cta,
      box: { x: 60, y: bottom - 130, width: W - 120, height: 130 },
      fontSize: 48,
      bold: true,
      stroke: true,
    }));
  }

  return { cutId: cut.id, canvas, layers };
}

function textLayer(input: {
  id: string;
  name: string;
  kind: VectorTextLayer["kind"];
  text: string;
  box: VectorTextLayer["box"];
  fontSize: number;
  bold?: boolean;
  stroke?: boolean;
  align?: "left" | "center";
}): VectorTextLayer {
  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    box: input.box,
    text: input.text,
    balloon: "none",
    style: {
      fontFamily: DEFAULT_TOON_FONT,
      fontSize: input.fontSize,
      lineHeight: 1.35,
      bold: input.bold,
      align: input.align ?? "center",
      // 이미지 위에 바로 얹는 글자는 흰 글자에 진한 테두리라야 어떤 배경에서도 읽힌다.
      color: input.stroke ? "#ffffff" : INK,
      strokeColor: input.stroke ? INK : undefined,
      strokeWidth: input.stroke ? 6 : undefined,
    },
  };
}

/**
 * 저장된 트리에 지금의 이미지 URL 을 다시 붙인다. 이 컷이 다시 생성됐으면
 * 새 이미지가 들어간다 — 레이어 배치는 그대로다.
 */
export function hydrateLayerTree(tree: CutLayerTree, cutId: string, imageUrl: string): CutLayerTree {
  return {
    ...tree,
    layers: tree.layers.map((l) =>
      "imageUrl" in l && l.sourceCutId === cutId ? { ...l, imageUrl } : l,
    ),
  };
}
