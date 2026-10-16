/**
 * 처음 여는 컷의 레이어 트리 — 생성 이미지 위에 콘티의 대사·나레이션·후킹·CTA 를
 * 벡터 레이어로 얹는다. 글자는 이미지에 굽지 않는다(PRD 3.2).
 *
 * 한 번 저장되면 그 뒤로는 저장된 트리를 쓴다. 이미지 URL 은 서명 URL 이라
 * 저장하지 않으므로, 열 때마다 `hydrateLayerTree` 로 다시 붙인다.
 */

import { normalizeBalloonKind, type BalloonKind, type CutLayerTree, type ImageLayer, type Layer, type VectorTextLayer } from "../types/layer";
import { characterName, type DialoguePosition, type Storyboard, type StoryboardCut } from "../types/storyboard";
import { DEFAULT_TOON_FONT } from "./fonts";

export const CANVAS_WIDTH = 1080;

/** 인스타 캐러셀 규격. 1:1 은 1080×1080, 4:5 는 1080×1350. */
export function canvasFor(aspectRatio: "1:1" | "4:5") {
  return { width: CANVAS_WIDTH, height: aspectRatio === "4:5" ? 1350 : 1080 };
}

const INK = "#121820";

/**
 * 대사 글자 수와 형태에 맞춘 말풍선 동적 크기 계산 (개선 제안 1: Auto-Sizing)
 * - 짧은 감탄사("네!", "진짜?")는 180~280px로 아담하게
 * - 일반 대사는 320~460px 가로폭에 1~2줄 높이
 * - 긴 대사는 480~520px에 3~4줄 높이로 자동 확장
 */
export function computeBalloonBoxSize(
  text: string,
  kind: BalloonKind,
  canvasWidth: number,
  _canvasHeight?: number,
): { width: number; height: number } {
  const clean = text.trim();
  const explicitLines = clean.split("\n");
  const totalLen = clean.length;

  const isSpike = kind === "shout" || kind === "spike";
  const isRound = kind === "thought" || kind === "cloud";

  let width: number;
  let height: number;

  if (totalLen <= 4 && explicitLines.length === 1) {
    // 초단문: "네!", "어?", "진짜?" 등 (1줄)
    width = Math.max(180, totalLen * 44 + 90);
    height = 115;
  } else if (totalLen <= 10 && explicitLines.length <= 1) {
    // 단문: "밥 먹었어?", "어디 가?" (1줄)
    width = Math.min(380, totalLen * 36 + 100);
    height = 125;
  } else if (totalLen <= 22 && explicitLines.length <= 2) {
    // 중단문 (1~2줄)
    const targetCols = Math.min(12, Math.max(8, Math.ceil(totalLen / 2)));
    width = Math.min(460, targetCols * 36 + 110);
    height = explicitLines.length === 2 || totalLen > 13 ? 155 : 135;
  } else if (totalLen <= 38) {
    // 중장문 (2~3줄)
    width = Math.min(480, canvasWidth - 140);
    const estimatedLines = Math.max(explicitLines.length, Math.ceil(totalLen / 12));
    height = Math.min(220, 110 + estimatedLines * 38);
  } else {
    // 장문 (3줄 이상)
    width = Math.min(520, canvasWidth - 120);
    const estimatedLines = Math.max(explicitLines.length, Math.ceil(totalLen / 13));
    height = Math.min(300, 110 + estimatedLines * 38);
  }

  // 모양별 안전 여백 보정
  if (isSpike) {
    width = Math.min(canvasWidth - 120, width + 24);
    height += 16;
  } else if (isRound) {
    width = Math.min(canvasWidth - 120, width + 20);
    height += 14;
  }

  return { width: Math.round(width), height: Math.round(height) };
}

/** 나레이션 박스 동적 높이 계산 (개선 제안 1) */
export function computeNarrationBoxHeight(text: string): number {
  const clean = text.trim();
  const explicitLines = clean.split("\n");
  const totalLen = clean.length;
  // 960px 폭에 36px 글자 기준, 한 줄에 한글 약 25자
  const estimatedLines = Math.max(explicitLines.length, Math.ceil(totalLen / 25));

  if (estimatedLines <= 1) return 90;
  if (estimatedLines === 2) return 130;
  if (estimatedLines === 3) return 170;
  return Math.min(240, 90 + (estimatedLines - 1) * 40);
}

/**
 * 스마트 꼬리 위치 및 방향 계산 (개선 제안 2: 상향/하향 지원 및 캔버스 클램핑)
 * - 상단 절반의 말풍선: 캐릭터가 아래에 있으므로 꼬리를 아래(하향)로 돌출
 * - 하단 절반의 말풍선: 캐릭터가 위에 있으므로 꼬리를 위(상향)로 돌출
 * - 좌측/우측/반려동물(중앙) 화자 위치에 맞춰 X 좌표 배치
 * - 캔버스 밖으로 나가지 않도록 안전 클램핑
 */
export function computeSmartTail(
  box: { x: number; y: number; width: number; height: number },
  side: "left" | "right" | "center",
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  // 수직 방향 결정: 말풍선 중앙이 캔버스 세로 55%보다 아래에 있으면 상향 꼬리, 위면 하향 꼬리
  const boxCenterY = box.y + box.height / 2;
  const isPointingUp = boxCenterY > canvasHeight * 0.55;

  let tailY: number;
  if (isPointingUp) {
    // 위를 향하는 꼬리 (상향 꼬리)
    tailY = Math.max(40, box.y - 90);
  } else {
    // 아래를 향하는 꼬리 (하향 꼬리)
    tailY = Math.min(canvasHeight - 40, box.y + box.height + 90);
  }

  // 수평 위치 결정
  let tailX: number;
  if (side === "center") {
    tailX = box.x + box.width / 2;
  } else if (side === "left") {
    tailX = box.x + Math.max(36, Math.min(90, box.width * 0.28));
  } else {
    tailX = box.x + box.width - Math.max(36, Math.min(90, box.width * 0.28));
  }

  return {
    x: Math.round(Math.max(40, Math.min(canvasWidth - 40, tailX))),
    y: Math.round(Math.max(40, Math.min(canvasHeight - 40, tailY))),
  };
}

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

  // 하단 여백 및 CTA/하단 나레이션 예약 영역 계산
  const cta = isLast
    ? storyboard.ctaOptions.find((c) => c.id === storyboard.selectedCtaId)?.text
    : undefined;
  let bottomLimit = H - 60;
  if (cta) {
    bottomLimit -= 140;
  }
  const hasBottomNarration =
    Boolean(cut.narration) &&
    !cut.dialogue.some((d) => !d.speakerId || d.balloon === "narration_box");
  if (hasBottomNarration && cut.narration) {
    bottomLimit -= computeNarrationBoxHeight(cut.narration) + 20;
  }

  // 개선 제안 3: 인공지능 콘티 위치 메타데이터 및 스마트 슬롯 배치
  let leftY = top;
  let rightY = top;

  cut.dialogue.forEach((line, i) => {
    const speaker = (line.speakerId || "").toLowerCase();
    const isSecondary =
      speaker.includes("vet") ||
      speaker.includes("doctor") ||
      speaker.includes("boss") ||
      speaker.includes("의사");
    const isPet = speaker.includes("cat") || speaker.includes("고양이") || speaker.includes("반려");

    // 나레이션 박스 처리
    if (line.balloon === "narration_box" || (!line.speakerId && line.balloon !== "none")) {
      const boxHeight = computeNarrationBoxHeight(line.text);
      const narrY = Math.max(leftY, rightY);
      layers.push({
        ...textLayer({
          id: `ly_line_${line.id}`,
          name: "나레이션 박스",
          kind: "narration",
          text: line.text,
          box: { x: 60, y: narrY, width: W - 120, height: boxHeight },
          fontSize: 36,
          align: "left",
        }),
        balloon: "narration_box",
        overridesSeriesStyle: false,
      });
      leftY = narrY + boxHeight + 20;
      rightY = leftY;
      return;
    }

    // 효과음 처리
    if (line.balloon === "none") {
      const sfxWidth = Math.min(W - 140, Math.max(220, line.text.length * 68 + 70));
      const sfxHeight = 110;
      const sfxY = Math.max(leftY, rightY);
      const isLeft = i % 2 === 0;
      layers.push(textLayer({
        id: `ly_line_${line.id}`,
        name: `효과음 "${line.text.slice(0, 6)}"`,
        kind: "sfx",
        text: line.text,
        box: {
          x: isLeft ? 80 : W - 80 - sfxWidth,
          y: sfxY,
          width: sfxWidth,
          height: sfxHeight,
          rotation: isLeft ? -6 : 6,
        },
        fontSize: 72,
        bold: true,
        stroke: true,
      }));
      if (isLeft) leftY += sfxHeight + 20;
      else rightY += sfxHeight + 20;
      return;
    }

    // 개선 제안 1: 텍스트 맞춤형 동적 크기 계산 (Auto-Sizing)
    const boxSize = computeBalloonBoxSize(line.text, line.balloon, W, H);

    // 개선 제안 3: 위치 메타데이터(position) 반영 및 스마트 좌/우/중앙/상/하 분기
    const posHint: DialoguePosition | undefined = line.position;
    let isBottom = false;
    let isCenter = false;
    let isLeft = false;

    if (posHint) {
      if (posHint === "top_left") {
        isLeft = true;
      } else if (posHint === "top_right") {
        isLeft = false;
      } else if (posHint === "bottom_left") {
        isLeft = true;
        isBottom = true;
      } else if (posHint === "bottom_right") {
        isLeft = false;
        isBottom = true;
      } else if (posHint === "top_center") {
        isCenter = true;
      } else if (posHint === "bottom_center") {
        isCenter = true;
        isBottom = true;
      }
    } else {
      // 힌트가 없을 때는 화자 및 순서 기반 지능형 배치
      if (isPet && i > 0) {
        isCenter = true;
      } else if (isSecondary) {
        isLeft = true;
      } else if (speaker.includes("me") || speaker.includes("나")) {
        isLeft = false;
      } else {
        isLeft = i % 2 === 0;
      }
    }

    let boxX: number;
    let boxY: number;

    if (isCenter) {
      boxX = Math.round((W - boxSize.width) / 2);
      boxY = isBottom
        ? bottomLimit - boxSize.height - 10
        : Math.max(leftY, rightY);
      if (!isBottom) {
        leftY = boxY + boxSize.height + 20;
        rightY = leftY;
      } else {
        bottomLimit = boxY - 20;
      }
    } else if (isBottom) {
      boxX = isLeft ? 70 : W - 70 - boxSize.width;
      boxY = bottomLimit - boxSize.height - 10;
      bottomLimit = boxY - 20;
    } else {
      boxX = isLeft ? 70 : W - 70 - boxSize.width;
      boxY = isLeft ? leftY : rightY;
      if (isLeft) {
        leftY += boxSize.height + 20;
      } else {
        rightY += boxSize.height + 20;
      }
    }

    // 하단 경계 안전 보정 (겹침 방지)
    if (boxY + boxSize.height > bottomLimit && !isBottom) {
      boxY = Math.max(top, bottomLimit - boxSize.height);
    }

    const box = {
      x: boxX,
      y: boxY,
      width: boxSize.width,
      height: boxSize.height,
    };

    // 개선 제안 2: 스마트 꼬리 방향 (상향/하향 및 화자 위치 지향)
    const side = isCenter || isPet ? "center" : isLeft ? "left" : "right";
    const tail = computeSmartTail(box, side, W, H);

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
      tail,
    });
  });

  let bottom = H - 60;
  if (hasBottomNarration && cut.narration) {
    const narrHeight = computeNarrationBoxHeight(cut.narration);
    bottom -= narrHeight;
    layers.push({
      ...textLayer({
        id: `ly_narr_${cut.id}`,
        name: "나레이션 박스",
        kind: "narration",
        text: cut.narration,
        box: { x: 60, y: bottom, width: W - 120, height: narrHeight },
        fontSize: 36,
        align: "left",
      }),
      balloon: "narration_box",
      // 시리즈 기본 스타일을 그대로 쓴다. 컷에서 덮어쓰면 true 가 된다.
      overridesSeriesStyle: false,
    });
    bottom -= 30;
  }

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
    layers: tree.layers.map((l) => {
      if ("imageUrl" in l) return l.sourceCutId === cutId ? { ...l, imageUrl } : l;
      // 예전 콘티에 모델이 지어낸 말풍선 이름이 저장돼 있으면 몸통 없이 글자만 그려진다. 여기서 맞춘다.
      if (l.kind === "balloon") {
        const balloon = normalizeBalloonKind(l.balloon);
        return balloon === l.balloon ? l : { ...l, balloon };
      }
      return l;
    }),
  };
}
