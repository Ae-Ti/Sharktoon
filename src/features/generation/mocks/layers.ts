/**
 * 레이어 트리 목 데이터 — PRD 3.2.
 *
 * 컷 5(현관에 주저앉은 장면)를 기준으로 배경·캐릭터 두 장과
 * 말풍선·나레이션·효과음 벡터 레이어를 한 번씩 담는다.
 */

import type { CutLayerTree } from "../types/layer";
import { mockCutImageUrl } from "./cutImage";

/** 컷 이미지 원본 크기. 인스타 1:1 기준. */
const CANVAS = { width: 1080, height: 1080 };

/** 작품 안 글꼴. UI 폰트(Pretendard)와 별개로 관리한다(디자인 가이드). */
const TOON_FONT = "Gaegu";

export const MOCK_LAYER_TREE: CutLayerTree = {
  cutId: "cut_5",
  canvas: CANVAS,
  layers: [
    {
      id: "ly_bg",
      name: "배경 · 현관",
      kind: "background",
      box: { x: 0, y: 0, width: 1080, height: 1080 },
      locked: true,
      imageUrl: mockCutImageUrl(5, "현관 바닥"),
      sourceCutId: "cut_5",
    },
    {
      id: "ly_ch_me",
      name: "캐릭터 · 나",
      kind: "character",
      box: { x: 250, y: 380, width: 420, height: 600 },
      imageUrl: mockCutImageUrl(5, "나"),
      sourceCutId: "cut_5",
    },
    {
      id: "ly_ch_dog",
      name: "캐릭터 · 설기",
      kind: "character",
      box: { x: 600, y: 560, width: 300, height: 340 },
      imageUrl: mockCutImageUrl(5, "설기"),
      sourceCutId: "cut_5",
    },
    {
      id: "ly_sfx",
      name: '효과음 "핥"',
      kind: "sfx",
      box: { x: 700, y: 480, width: 220, height: 90, rotation: -8 },
      text: "핥",
      balloon: "none",
      style: {
        fontFamily: TOON_FONT,
        fontSize: 64,
        lineHeight: 1.1,
        bold: true,
        align: "center",
        color: "#ffffff",
        strokeColor: "#12333a",
        strokeWidth: 6,
      },
    },
    {
      id: "ly_balloon",
      name: "말풍선 · 속삭임",
      kind: "balloon",
      box: { x: 120, y: 180, width: 480, height: 170 },
      text: "...왜 이렇게 반가워해.",
      balloon: "whisper",
      tail: { x: 420, y: 400 },
      style: {
        fontFamily: TOON_FONT,
        fontSize: 38,
        lineHeight: 1.4,
        align: "center",
        color: "#121820",
      },
    },
    {
      id: "ly_narration",
      name: "나레이션 박스",
      kind: "narration",
      box: { x: 90, y: 900, width: 900, height: 96 },
      text: "참았던 게 그제야 터졌다.",
      balloon: "narration_box",
      // 시리즈 기본 스타일을 그대로 쓴다. 컷에서 덮어쓰면 이 값이 true 가 된다.
      overridesSeriesStyle: false,
      style: {
        fontFamily: TOON_FONT,
        fontSize: 34,
        lineHeight: 1.4,
        align: "left",
        color: "#121820",
      },
    },
  ],
};
