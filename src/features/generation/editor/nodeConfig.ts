/**
 * 벡터 레이어를 konva 노드 설정으로 옮긴다. 편집 캔버스(react-konva)와
 * 내보내기 렌더러(konva 직접)가 같은 설정을 쓴다 — 화면과 PNG 가 같아야 한다.
 */

import type { VectorTextLayer } from "../types/layer";
import { BALLOON_SHAPE, tailBubbles, tailWedge, textPadding } from "./shapes";

const PAPER = "#ffffff";
const INK = "#121820";

export function bodyConfig(layer: VectorTextLayer) {
  const shape = BALLOON_SHAPE[layer.balloon];
  if (!shape) return null;
  return {
    x: layer.box.x,
    y: layer.box.y,
    width: layer.box.width,
    height: layer.box.height,
    rotation: layer.box.rotation ?? 0,
    cornerRadius: shape.radius(layer.box),
    fill: PAPER,
    stroke: INK,
    strokeWidth: shape.stroke,
    dash: shape.dash,
    listening: false,
  };
}

/**
 * 꼬리. 몸통 위에 그린다 — 채운 삼각형이 밑변의 몸통 테두리를 덮고,
 * 테두리는 두 옆변에만 긋는다. 그래야 꼬리와 몸통이 한 덩어리로 보인다.
 */
export function tailConfigs(layer: VectorTextLayer) {
  const shape = BALLOON_SHAPE[layer.balloon];
  if (!shape?.tail || !layer.tail) return null;

  if (shape.tail === "bubbles") {
    const bubbles = tailBubbles(layer.box, layer.tail);
    return {
      kind: "bubbles" as const,
      circles: bubbles.map((b) => ({
        x: b.x,
        y: b.y,
        radius: b.r,
        fill: PAPER,
        stroke: INK,
        strokeWidth: shape.stroke,
        listening: false,
      })),
    };
  }

  const wedge = tailWedge(layer.box, layer.tail);
  if (!wedge) return null;
  const [a, b] = wedge.base;
  const t = wedge.tip;
  return {
    kind: "wedge" as const,
    fill: {
      points: [a.x, a.y, t.x, t.y, b.x, b.y],
      closed: true,
      fill: PAPER,
      listening: false,
    },
    outline: {
      points: [a.x, a.y, t.x, t.y, b.x, b.y],
      stroke: INK,
      strokeWidth: shape.stroke,
      dash: shape.dash,
      lineJoin: "round" as const,
      listening: false,
    },
  };
}

export function textConfig(layer: VectorTextLayer) {
  return {
    x: layer.box.x,
    y: layer.box.y,
    width: layer.box.width,
    height: layer.box.height,
    rotation: layer.box.rotation ?? 0,
    opacity: layer.opacity ?? 1,
    text: layer.text,
    fontFamily: `"${layer.style.fontFamily}", sans-serif`,
    fontSize: layer.style.fontSize,
    fontStyle: layer.style.bold ? "bold" : "normal",
    lineHeight: layer.style.lineHeight,
    align: layer.style.align ?? "center",
    verticalAlign: "middle",
    padding: textPadding(layer.balloon, layer.box),
    fill: layer.style.color ?? INK,
    stroke: layer.style.strokeColor,
    strokeWidth: layer.style.strokeWidth ?? 0,
    // 테두리가 있는 글자는 획이 글자 안쪽을 먹지 않게 채우기를 뒤에 칠한다.
    fillAfterStrokeEnabled: Boolean(layer.style.strokeWidth),
  };
}
