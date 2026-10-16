"use client";

import React from "react";
import type { CutLayerTree, VectorTextLayer } from "../types/layer";
import { cn } from "@/lib/cn";

export type ElementPresetId =
  | "balloon_normal"
  | "balloon_thought"
  | "balloon_shout"
  | "narration_top"
  | "narration_bottom"
  | "sfx"
  | "title_hook"
  | "text";

export interface ElementTemplateItem {
  id: ElementPresetId;
  title: string;
  desc: string;
  badge: string;
  preview: {
    bg: string;
    border: string;
    sampleText: string;
    textColor: string;
  };
}

export const ELEMENT_TEMPLATES: ElementTemplateItem[] = [
  {
    id: "balloon_normal",
    title: "대사 말풍선",
    desc: "인물의 기본 대사와 말꼬리",
    badge: "기본",
    preview: {
      bg: "bg-surface-card",
      border: "border-2 border-ink rounded-2xl",
      sampleText: "대사를 적어요",
      textColor: "text-ink",
    },
  },
  {
    id: "balloon_thought",
    title: "생각 / 속마음",
    desc: "속마음을 표현하는 방울 꼬리",
    badge: "생각",
    preview: {
      bg: "bg-surface-card",
      border: "border-2 border-ink rounded-full",
      sampleText: "속마음 생각...",
      textColor: "text-ink",
    },
  },
  {
    id: "balloon_shout",
    title: "외침 / 샤우트",
    desc: "놀람과 외침을 나타내는 강조 테두리",
    badge: "강조",
    preview: {
      bg: "bg-amber-50/80",
      border: "border-2 border-ink rounded-sm",
      sampleText: "앗 깜짝이야!",
      textColor: "text-ink",
    },
  },
  {
    id: "narration_top",
    title: "상단 나레이션",
    desc: "컷 상단에 고정되는 상황 설명 박스",
    badge: "나레이션",
    preview: {
      bg: "bg-surface-card/90",
      border: "border border-ink/80 rounded-md",
      sampleText: "어느 날 오후...",
      textColor: "text-ink",
    },
  },
  {
    id: "narration_bottom",
    title: "하단 나레이션",
    desc: "컷 하단에 배치되는 여운/설명 박스",
    badge: "나레이션",
    preview: {
      bg: "bg-surface-card/90",
      border: "border border-ink/80 rounded-md",
      sampleText: "상황을 설명하는 글",
      textColor: "text-ink",
    },
  },
  {
    id: "sfx",
    title: "효과음 (SFX)",
    desc: "장면을 실감나게 만드는 큰 소리 글자",
    badge: "SFX",
    preview: {
      bg: "transparent",
      border: "border-0",
      sampleText: "쿵!!",
      textColor: "text-rose-600 font-extrabold text-lg tracking-wider",
    },
  },
  {
    id: "title_hook",
    title: "제목 · 후킹",
    desc: "첫 컷 상단 독자 시선을 끄는 제목",
    badge: "타이틀",
    preview: {
      bg: "bg-surface-card/95",
      border: "border-b-2 border-brand rounded-none",
      sampleText: "첫 컷 제목 문구",
      textColor: "text-ink font-bold",
    },
  },
  {
    id: "text",
    title: "자유 텍스트",
    desc: "배경 없이 자유롭게 배치하는 글자",
    badge: "텍스트",
    preview: {
      bg: "transparent",
      border: "border-dashed border-border rounded-md",
      sampleText: "자유 글자",
      textColor: "text-ink",
    },
  },
];

/** 템플릿 ID로 새 벡터 레이어 생성 */
import {
  computeBalloonBoxSize,
  computeNarrationBoxHeight,
  computeSmartTail,
} from "./buildLayerTree";

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
    case "narration_top": {
      const text = textVal || "어느 날 오후...";
      const width = W - 120;
      const height = computeNarrationBoxHeight(text);
      return {
        id: `ly_narr_top_${uid}`,
        name: "상단 나레이션",
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
    case "narration_bottom": {
      const text = textVal || "상황을 설명하는 나레이션";
      const width = W - 120;
      const height = computeNarrationBoxHeight(text);
      return {
        id: `ly_narr_bot_${uid}`,
        name: "하단 나레이션",
        kind: "narration",
        box: { x: 60, y: H - height - 70, width, height },
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
    case "title_hook": {
      const width = W - 120;
      const height = 140;
      return {
        id: `ly_hook_${uid}`,
        name: "제목 · 후킹",
        kind: "text",
        box: { x: 60, y: 70, width, height },
        text: textVal || "첫 컷 제목 문구",
        balloon: "none",
        style: {
          fontFamily: "Gowun Dodum",
          fontSize: 54,
          lineHeight: 1.3,
          align: "center",
          color: "#121820",
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

export function ElementPalette({
  onSelectPreset,
}: {
  onSelectPreset: (presetId: ElementPresetId) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        {ELEMENT_TEMPLATES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectPreset(item.id)}
            className="group relative flex flex-col items-start gap-2 rounded-xl border border-border bg-surface-card p-3 text-left shadow-2xs transition-all hover:border-brand hover:shadow-xs focus:border-brand focus:outline-hidden"
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-body-sm font-semibold text-ink group-hover:text-brand">
                {item.title}
              </span>
              <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                {item.badge}
              </span>
            </div>

            {/* 미니 비주얼 프리뷰 */}
            <div className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-lg bg-surface-sunken/60 p-2">
              <div
                className={cn(
                  "flex items-center justify-center px-2 py-1 text-[11px] font-medium shadow-2xs",
                  item.preview.bg,
                  item.preview.border,
                  item.preview.textColor,
                )}
              >
                {item.preview.sampleText}
              </div>
            </div>

            <p className="line-clamp-1 text-[11px] text-ink-muted group-hover:text-ink">
              {item.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

