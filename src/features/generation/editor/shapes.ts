/**
 * 말풍선 모양과 꼬리 — 편집 캔버스와 내보내기 렌더러가 같이 쓴다.
 * 두 군데서 따로 그리면 화면과 내보낸 PNG 가 어긋난다.
 *
 * 값의 근거는 docs/편집기_캔버스_규칙.md "말풍선".
 */

import type { BalloonKind, LayerBox } from "../types/layer";

export interface BalloonShape {
  radius: (box: LayerBox) => number;
  stroke: number;
  dash?: number[];
  /** 꼬리 모양. 없으면 꼬리를 그리지 않는다. */
  tail: "wedge" | "bubbles" | null;
}

export const BALLOON_SHAPE: Record<BalloonKind, BalloonShape | null> = {
  none: null,
  normal: { radius: (b) => Math.min(b.height / 2.2, 48), stroke: 3, tail: "wedge" },
  shout: { radius: () => 8, stroke: 4, tail: "wedge" },
  spike: { radius: () => 4, stroke: 4, tail: "wedge" },
  whisper: { radius: (b) => Math.min(b.height / 2.2, 48), stroke: 2, dash: [12, 8], tail: "wedge" },
  thought: { radius: (b) => b.height / 2, stroke: 3, tail: "bubbles" },
  cloud: { radius: (b) => b.height / 2, stroke: 3, tail: "bubbles" },
  telepathy: { radius: (b) => b.height / 2, stroke: 2, dash: [4, 6], tail: null },
  broadcast: { radius: () => 6, stroke: 3, dash: [16, 6], tail: "wedge" },
  wobble: { radius: (b) => Math.min(b.height / 3, 32), stroke: 3, tail: "wedge" },
  chain: { radius: (b) => Math.min(b.height / 2.2, 48), stroke: 3, tail: "wedge" },
  narration_box: { radius: () => 6, stroke: 1.5, tail: null },
};

export interface Point {
  x: number;
  y: number;
}

/**
 * 꼬리 밑변 두 점과 끝점. 꼬리가 몸통 안쪽을 가리키면 null(그릴 것이 없다).
 * 말풍선 회전(rotation)을 완벽히 지원하여, 회전된 변 위에서도 꼬리가 파고들지 않고
 * 정확히 변의 법선/접선 방향에 맞추어 밑변을 배치합니다.
 */
export function tailWedge(
  box: LayerBox,
  tip: Point,
  inset: number = 4,
): { base: [Point, Point]; tip: Point } | null {
  const { x, y, width: w, height: h, rotation = 0 } = box;
  const rad = ((rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // tip 좌표를 box의 로컬(회전 전 기준) 좌표계로 변환
  const dx = tip.x - x;
  const dy = tip.y - y;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;

  // 로컬 좌표계 기준 박스 내부 판정
  const inside = lx > 0 && lx < w && ly > 0 && ly < h;
  if (inside) return null;

  const half = Math.max(10, Math.min(w, h) * 0.12);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const below = ly >= h;
  const above = ly <= 0;
  let baseLocal: [Point, Point];

  if (below || above) {
    const cx = clamp(lx, w * 0.2 + half, w * 0.8 - half);
    const by = below ? h - inset : inset;
    baseLocal = [
      { x: cx - half, y: by },
      { x: cx + half, y: by },
    ];
  } else {
    const cy = clamp(ly, h * 0.2 + half, h * 0.8 - half);
    const bx = lx >= w ? w - inset : inset;
    baseLocal = [
      { x: bx, y: cy - half },
      { x: bx, y: cy + half },
    ];
  }

  // 로컬 밑변 두 점을 글로벌 캔버스 좌표계로 역변환
  const toGlobal = (p: Point): Point => ({
    x: Math.round((x + p.x * cos - p.y * sin) * 10) / 10,
    y: Math.round((y + p.x * sin + p.y * cos) * 10) / 10,
  });

  return {
    base: [toGlobal(baseLocal[0]), toGlobal(baseLocal[1])],
    tip,
  };
}

/**
 * 말풍선 박스가 이동 또는 회전할 때 꼬리 끝점을 함께 변환한다.
 * 박스 로컬 좌표계에서의 상대 위치와 각도를 보존하므로, 말풍선 회전 시 꼬리도 함께 회전합니다.
 */
export function transformTailWithBox(
  oldBox: LayerBox,
  newBox: LayerBox,
  oldTail: Point,
): Point {
  const rad0 = ((oldBox.rotation ?? 0) * Math.PI) / 180;
  const rad1 = ((newBox.rotation ?? 0) * Math.PI) / 180;

  // 1. oldBox 기준 로컬 좌표계로 변환
  const dx0 = oldTail.x - oldBox.x;
  const dy0 = oldTail.y - oldBox.y;
  const lx = dx0 * Math.cos(rad0) + dy0 * Math.sin(rad0);
  const ly = -dx0 * Math.sin(rad0) + dy0 * Math.cos(rad0);

  // 2. newBox 기준 글로벌 좌표계로 변환
  const newX = newBox.x + lx * Math.cos(rad1) - ly * Math.sin(rad1);
  const newY = newBox.y + lx * Math.sin(rad1) + ly * Math.cos(rad1);

  return {
    x: Math.round(newX),
    y: Math.round(newY),
  };
}

/**
 * 꼬리 곡선화 — 쐐기 꼬리의 양 변을 부드러운 2차 베지어 곡선으로 표본추출하여 반환한다.
 * @param wedge tailWedge 결과 (밑변 [a, b]와 끝점 tip)
 * @param curvature 곡률 백분율 (-100 ~ 100, 0이면 직선, 기본 25)
 * @param steps 곡선 분할 수 (기본 12)
 */
export function curvedTailWedgePoints(
  wedge: { base: [Point, Point]; tip: Point },
  curvature: number = 25,
  steps: number = 12,
): number[] {
  const [a, b] = wedge.base;
  const tip = wedge.tip;
  if (!curvature) {
    return [a.x, a.y, tip.x, tip.y, b.x, b.y];
  }

  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const vx = tip.x - mx;
  const vy = tip.y - my;
  const len = Math.hypot(vx, vy);
  if (len < 5) return [a.x, a.y, tip.x, tip.y, b.x, b.y];

  // 밑변 중심에서 끝점으로 향하는 단위 벡터
  const ux = vx / len;
  const uy = vy / len;
  // 수직 단위 벡터 (외곽으로 휘는 방향)
  const nx = -uy;
  const ny = ux;

  // 휘는 거리 계산
  const bend = (curvature / 100) * len;
  const bendX = nx * bend;
  const bendY = ny * bend;

  // 변 1 (a -> tip)과 변 2 (tip -> b)의 베지어 제어점
  const cpA = { x: (a.x + tip.x) / 2 + bendX, y: (a.y + tip.y) / 2 + bendY };
  const cpB = { x: (b.x + tip.x) / 2 + bendX, y: (b.y + tip.y) / 2 + bendY };

  const points: number[] = [];
  // a -> tip 표본추출 (i=0부터 steps까지)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const x = inv * inv * a.x + 2 * inv * t * cpA.x + t * t * tip.x;
    const y = inv * inv * a.y + 2 * inv * t * cpA.y + t * t * tip.y;
    points.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  }
  // tip -> b 표본추출 (i=1부터 steps까지, tip 중복 제거)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const x = inv * inv * tip.x + 2 * inv * t * cpB.x + t * t * b.x;
    const y = inv * inv * tip.y + 2 * inv * t * cpB.y + t * t * b.y;
    points.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  }
  return points;
}

/** 생각 풍선의 꼬리 — 몸통에서 끝점까지 작아지는 동그라미 셋 (곡률 지원). */
export function tailBubbles(
  box: LayerBox,
  tip: Point,
  curvature: number = 0,
): { x: number; y: number; r: number }[] {
  const wedge = tailWedge(box, tip);
  if (!wedge) return [];
  const start = {
    x: (wedge.base[0].x + wedge.base[1].x) / 2,
    y: (wedge.base[0].y + wedge.base[1].y) / 2,
  };
  const r0 = Math.max(8, Math.min(box.width, box.height) * 0.08);
  const vx = tip.x - start.x;
  const vy = tip.y - start.y;
  const len = Math.hypot(vx, vy);
  const nx = len > 0 ? -vy / len : 0;
  const ny = len > 0 ? vx / len : 0;
  const bend = (curvature / 100) * len;

  return [0.35, 0.65, 0.92].map((t, i) => {
    const arc = 4 * t * (1 - t);
    return {
      x: start.x + (tip.x - start.x) * t + nx * bend * arc,
      y: start.y + (tip.y - start.y) * t + ny * bend * arc,
      r: r0 * (1 - i * 0.3),
    };
  });
}

/** 글자 여백. 말풍선 폭의 6% — 고정 px 로 두면 작은 말풍선에서 글자가 다 잘린다. */
export function textPadding(kind: BalloonKind, box: LayerBox): number {
  return kind === "none" ? 0 : Math.round(box.width * 0.06);
}
