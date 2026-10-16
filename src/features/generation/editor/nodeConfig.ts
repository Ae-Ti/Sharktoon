/**
 * 벡터 레이어를 konva 노드 설정으로 옮긴다. 편집 캔버스(react-konva)와
 * 내보내기 렌더러(konva 직접)가 같은 설정을 쓴다 — 화면과 PNG 가 같아야 한다.
 */

import type { VectorTextLayer } from "../types/layer";
import {
  BALLOON_SHAPE,
  curvedTailWedgePoints,
  tailBubbles,
  tailWedge,
  textPadding,
} from "./shapes";

const PAPER = "#ffffff";
const INK = "#121820";

/**
 * 말풍선 레이어인데 모르는 종류(예전 콘티에 모델이 지어낸 이름이 저장된 경우)면 기본 말풍선으로 그린다.
 * 몸통이 빠지고 글자만 남는 일이 없게.
 */
function shapeOf(layer: VectorTextLayer) {
  const shape = BALLOON_SHAPE[layer.balloon];
  if (shape !== undefined) return shape;
  return layer.kind === "balloon" ? BALLOON_SHAPE.normal : null;
}

export function bodyConfig(layer: VectorTextLayer) {
  const shape = shapeOf(layer);
  if (!shape) return null;
  return {
    x: layer.box.x,
    y: layer.box.y,
    width: layer.box.width,
    height: layer.box.height,
    rotation: layer.box.rotation ?? 0,
    cornerRadius: shape.radius(layer.box),
    fill: PAPER,
    stroke: layer.borderColor ?? INK,
    strokeWidth: layer.borderWidth ?? shape.stroke,
    dash: shape.dash,
    listening: false,
  };
}

/**
 * 꼬리. 몸통 위에 그린다 — 채운 삼각형이 밑변의 몸통 테두리를 덮고,
 * 테두리는 두 옆변에만 긋는다. 그래야 꼬리와 몸통이 한 덩어리로 보인다.
 */
export function tailConfigs(layer: VectorTextLayer) {
  const shape = shapeOf(layer);
  if (!shape?.tail || !layer.tail) return null;

  const strokeColor = layer.borderColor ?? INK;
  const strokeWidth = layer.borderWidth ?? shape.stroke;
  const inset = Math.max(4, Math.round(strokeWidth + 2));
  const curvature = layer.tailCurved ? (layer.tailCurvature ?? 25) : 0;

  if (shape.tail === "bubbles") {
    const bubbles = tailBubbles(layer.box, layer.tail, curvature);
    return {
      kind: "bubbles" as const,
      circles: bubbles.map((b) => ({
        x: b.x,
        y: b.y,
        radius: b.r,
        fill: PAPER,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        listening: false,
      })),
    };
  }

  const wedge = tailWedge(layer.box, layer.tail, inset);
  if (!wedge) return null;
  const [a, b] = wedge.base;
  const t = wedge.tip;
  const points = layer.tailCurved
    ? curvedTailWedgePoints(wedge, curvature)
    : [a.x, a.y, t.x, t.y, b.x, b.y];

  return {
    kind: "wedge" as const,
    fill: {
      points,
      closed: true,
      fill: PAPER,
      listening: false,
    },
    outline: {
      points,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
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
