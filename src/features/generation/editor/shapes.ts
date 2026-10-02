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
 * 밑변은 꼬리 쪽 변 위에 두되 모서리 둥근 부분(양끝 20%)은 피한다.
 */
export function tailWedge(box: LayerBox, tip: Point): { base: [Point, Point]; tip: Point } | null {
  const { x, y, width: w, height: h } = box;
  const inside = tip.x > x && tip.x < x + w && tip.y > y && tip.y < y + h;
  if (inside) return null;

  const half = Math.max(10, Math.min(w, h) * 0.12);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  // 테두리를 덮도록 밑변을 몸통 안쪽으로 조금 넣는다.
  const inset = 4;

  const below = tip.y >= y + h;
  const above = tip.y <= y;
  if (below || above) {
    const cx = clamp(tip.x, x + w * 0.2 + half, x + w * 0.8 - half);
    const by = below ? y + h - inset : y + inset;
    return { base: [{ x: cx - half, y: by }, { x: cx + half, y: by }], tip };
  }
  const cy = clamp(tip.y, y + h * 0.2 + half, y + h * 0.8 - half);
  const bx = tip.x >= x + w ? x + w - inset : x + inset;
  return { base: [{ x: bx, y: cy - half }, { x: bx, y: cy + half }], tip };
}

/** 생각 풍선의 꼬리 — 몸통에서 끝점까지 작아지는 동그라미 셋. */
export function tailBubbles(box: LayerBox, tip: Point): { x: number; y: number; r: number }[] {
  const wedge = tailWedge(box, tip);
  if (!wedge) return [];
  const start = {
    x: (wedge.base[0].x + wedge.base[1].x) / 2,
    y: (wedge.base[0].y + wedge.base[1].y) / 2,
  };
  const r0 = Math.max(8, Math.min(box.width, box.height) * 0.08);
  return [0.35, 0.65, 0.92].map((t, i) => ({
    x: start.x + (tip.x - start.x) * t,
    y: start.y + (tip.y - start.y) * t,
    r: r0 * (1 - i * 0.3),
  }));
}

/** 글자 여백. 말풍선 폭의 6% — 고정 px 로 두면 작은 말풍선에서 글자가 다 잘린다. */
export function textPadding(kind: BalloonKind, box: LayerBox): number {
  return kind === "none" ? 0 : Math.round(box.width * 0.06);
}
