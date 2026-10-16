"use client";

import type { CutLayerTree, VectorTextLayer } from "../types/layer";
import {
  computeBalloonBoxSize,
  computeNarrationBoxHeight,
  computeSmartTail,
} from "./buildLayerTree";

export type ElementPresetId =
  | "balloon_normal"
  | "balloon_thought"
  | "balloon_shout"
  | "narration"
  | "sfx"
  | "text";

/** 템플릿 ID로 새 벡터 레이어 생성 */
export function buildLayerFromPreset(
  tree: CutLayerTree,
  presetId: ElementPresetId,
  customText?: string,
): VectorTextLayer {
  const W = tree.canvas.width;
  const H = tree.canvas.height;
  const uid = crypto.randomUUID().slice(0, 8);
  const textVal = customText?.trim();

  switch (presetId) {
    case "balloon_normal": {
      const text = textVal || "대사를 적어요";
      const size = computeBalloonBoxSize(text, "normal", W, H);
      const box = {
        x: Math.round((W - size.width) / 2),
        y: Math.round((H - size.height) / 2),
        width: size.width,
        height: size.height,
      };
      const tail = computeSmartTail(box, "center", W, H);
      return {
        id: `ly_balloon_${uid}`,
        name: "대사 말풍선",
        kind: "balloon",
        box,
        text,
        balloon: "normal",
        tail,
        style: {
          fontFamily: "Gowun Dodum",
          fontSize: 38,
          lineHeight: 1.4,
          align: "center",
          color: "#121820",
        },
      };
    }
    case "balloon_thought": {
      const text = textVal || "속마음 생각...";
      const size = computeBalloonBoxSize(text, "thought", W, H);
      const box = {
        x: Math.round((W - size.width) / 2),
        y: Math.round(H * 0.35),
        width: size.width,
        height: size.height,
      };
      const tail = computeSmartTail(box, "center", W, H);
      return {
        id: `ly_thought_${uid}`,
        name: "생각 말풍선",
        kind: "balloon",
        box,
        text,
        balloon: "thought",
        tail,
        style: {
          fontFamily: "Gowun Dodum",
          fontSize: 36,
          lineHeight: 1.4,
          align: "center",
          color: "#121820",
        },
      };
    }
    case "balloon_shout": {
      const text = textVal || "앗 깜짝이야!";
      const size = computeBalloonBoxSize(text, "shout", W, H);
      const box = {
        x: Math.round((W - size.width) / 2),
        y: Math.round((H - size.height) / 2),
        width: size.width,
        height: size.height,
      };
      const tail = computeSmartTail(box, "center", W, H);
      return {
        id: `ly_shout_${uid}`,
        name: "외침 말풍선",
        kind: "balloon",
        box,
        text,
        balloon: "shout",
        tail,
        style: {
          fontFamily: "Gowun Dodum",
          fontSize: 40,
          lineHeight: 1.4,
          align: "center",
          color: "#121820",
          bold: true,
        },
      };
    }
    case "narration": {
      const text = textVal || "어느 날 오후...";
      const width = W - 120;
      const height = computeNarrationBoxHeight(text);
      return {
        id: `ly_narr_${uid}`,
        name: "나레이션",
        kind: "narration",
        box: { x: 60, y: 60, width, height },
        text,
        balloon: "narration_box",
        style: {
          fontFamily: "Gowun Dodum",
          fontSize: 34,
          lineHeight: 1.4,
          align: "left",
          color: "#121820",
        },
      };
    }
    case "sfx": {
      const width = 340;
      const height = 140;
      return {
        id: `ly_sfx_${uid}`,
        name: "효과음",
        kind: "sfx",
        box: {
          x: Math.round((W - width) / 2),
          y: Math.round((H - height) / 2),
          width,
          height,
        },
        text: textVal || "쿵!!",
        balloon: "none",
        style: {
          fontFamily: "Do Hyeon",
          fontSize: 76,
          lineHeight: 1.2,
          align: "center",
          color: "#e11d48",
          bold: true,
        },
      };
    }
    case "text":
    default: {
      const width = Math.round(W * 0.44);
      const height = Math.round(H * 0.12);
      return {
        id: `ly_text_${uid}`,
        name: "텍스트",
        kind: "text",
        box: {
          x: Math.round((W - width) / 2),
          y: Math.round((H - height) / 2),
          width,
          height,
        },
        text: textVal || "여기에 글",
        balloon: "none",
        style: {
          fontFamily: "Gowun Dodum",
          fontSize: 38,
          lineHeight: 1.4,
          align: "center",
          color: "#121820",
        },
      };
    }
  }
}
