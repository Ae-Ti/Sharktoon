"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer as KonvaLayer, Image as KonvaImage, Text, Rect, Transformer } from "react-konva";
import type Konva from "konva";
import {
  isVectorTextLayer,
  type CutLayerTree,
  type ImageLayer,
  type Layer,
  type LayerBox,
  type VectorTextLayer,
} from "../types/layer";

export interface EditorCanvasProps {
  tree: CutLayerTree;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** 조작 시작. 이 시점의 상태가 이력의 "이전 칸"이 된다. */
  onBeginDrag: () => void;
  /** 드래그·리사이즈 중. 이력에 쌓이지 않는다. */
  onPreviewBox: (id: string, box: Partial<LayerBox>) => void;
  /** 조작 끝. 이력 한 칸이 된다. */
  onCommit: () => void;
  /** 캔버스가 차지할 화면 폭(px). 부모가 재어서 준다. */
  size: number;
}

/**
 * 컷 편집 캔버스 — PRD 3.2.
 *
 * 좌표는 전부 컷 이미지 원본 픽셀(1080)로 들고, 화면 배율은 Stage 의 scale 로만 준다.
 * 이렇게 해야 확대해도 레이어 값이 안 흔들리고, 내보낼 때 원본 배율로 그대로 그린다.
 */
export function EditorCanvas({
  tree,
  selectedId,
  onSelect,
  onBeginDrag,
  onPreviewBox,
  onCommit,
  size,
}: EditorCanvasProps) {
  const scale = size / tree.canvas.width;
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());

  // 선택이 바뀌면 변형 핸들을 그 노드에 붙인다.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, tree.layers]);

  function register(id: string, node: Konva.Node | null) {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }

  return (
    <Stage
      width={size}
      height={size * (tree.canvas.height / tree.canvas.width)}
      scale={{ x: scale, y: scale }}
      // 빈 곳을 누르면 선택을 푼다. 터치에서도 같아야 한다.
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) onSelect(null);
      }}
      onTouchStart={(e) => {
        if (e.target === e.target.getStage()) onSelect(null);
      }}
      className="touch-none rounded-lg"
    >
      <KonvaLayer>
        {tree.layers.map((layer) => {
          if (layer.hidden) return null;

          const common = {
            id: layer.id,
            x: layer.box.x,
            y: layer.box.y,
            width: layer.box.width,
            height: layer.box.height,
            rotation: layer.box.rotation ?? 0,
            opacity: layer.opacity ?? 1,
            draggable: !layer.locked,
            onMouseDown: () => onSelect(layer.id),
            onTouchStart: () => onSelect(layer.id),
            onDragStart: onBeginDrag,
            onTransformStart: onBeginDrag,
            onDragMove: (e: Konva.KonvaEventObject<DragEvent>) =>
              onPreviewBox(layer.id, { x: e.target.x(), y: e.target.y() }),
            onDragEnd: onCommit,
            /**
             * Transformer 는 width/height 가 아니라 scale 을 바꾼다. 그대로 두면
             * 레이어 값과 화면이 어긋나므로 scale 을 크기로 환산하고 1로 되돌린다.
             */
            onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
              const node = e.target;
              const sx = node.scaleX();
              const sy = node.scaleY();
              node.scaleX(1);
              node.scaleY(1);
              onPreviewBox(layer.id, {
                x: node.x(),
                y: node.y(),
                width: Math.max(24, node.width() * sx),
                height: Math.max(24, node.height() * sy),
                rotation: node.rotation(),
              });
              onCommit();
            },
          };

          return isVectorTextLayer(layer) ? (
            <VectorNode
              key={layer.id}
              layer={layer}
              common={common}
              register={register}
            />
          ) : (
            <ImageNode
              key={layer.id}
              layer={layer as ImageLayer}
              common={common}
              register={register}
            />
          );
        })}

        <Transformer
          ref={trRef}
          rotateEnabled
          // 44px 터치 규칙(디자인 가이드). 캔버스 배율을 거슬러 화면상 크기를 맞춘다.
          anchorSize={12 / scale}
          anchorCornerRadius={3 / scale}
          borderStrokeWidth={1.5 / scale}
          // 너무 작아지면 다시 잡을 수 없다.
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 24 || newBox.height < 24 ? oldBox : newBox
          }
        />
      </KonvaLayer>
    </Stage>
  );
}

type CommonProps = Record<string, unknown>;

/** 생성 이미지 레이어. 브라우저에서 이미지를 받아 놓아야 konva 가 그린다. */
function ImageNode({
  layer,
  common,
  register,
}: {
  layer: ImageLayer;
  common: CommonProps;
  register: (id: string, node: Konva.Node | null) => void;
}) {
  const image = useHtmlImage(layer.imageUrl);
  if (!image) return null;
  return (
    <KonvaImage
      {...common}
      image={image}
      ref={(node) => register(layer.id, node)}
    />
  );
}

/**
 * 말풍선·텍스트·나레이션·효과음. 이미지에 굽지 않으므로 konva 도형과 텍스트로 그린다.
 * 모양은 종류마다 다르지만 글자 배치 규칙은 같아서 한 군데서 처리한다.
 */
function VectorNode({
  layer,
  common,
  register,
}: {
  layer: VectorTextLayer;
  common: CommonProps;
  register: (id: string, node: Konva.Node | null) => void;
}) {
  const shape = BALLOON_SHAPE[layer.balloon];
  const pad = layer.balloon === "none" ? 0 : Math.round(layer.box.width * 0.06);

  return (
    <>
      {shape && (
        <Rect
          x={layer.box.x}
          y={layer.box.y}
          width={layer.box.width}
          height={layer.box.height}
          rotation={layer.box.rotation ?? 0}
          cornerRadius={shape.radius(layer.box)}
          fill="#ffffff"
          stroke="#121820"
          strokeWidth={shape.stroke}
          dash={shape.dash}
          listening={false}
        />
      )}
      <Text
        {...common}
        ref={(node) => register(layer.id, node)}
        text={layer.text}
        fontFamily={layer.style.fontFamily}
        fontSize={layer.style.fontSize}
        fontStyle={layer.style.bold ? "bold" : "normal"}
        lineHeight={layer.style.lineHeight}
        align={layer.style.align ?? "center"}
        verticalAlign="middle"
        padding={pad}
        fill={layer.style.color ?? "#121820"}
        stroke={layer.style.strokeColor}
        strokeWidth={layer.style.strokeWidth ?? 0}
        // 효과음처럼 테두리가 있는 글자는 획이 글자 안쪽을 먹지 않게 채우기를 뒤에 칠한다.
        fillAfterStrokeEnabled={Boolean(layer.style.strokeWidth)}
      />
    </>
  );
}

/** 말풍선 모양. 꼬리는 2차(경로 도형)에서 붙인다 — 지금은 몸통만이다. */
const BALLOON_SHAPE: Record<
  string,
  { radius: (box: LayerBox) => number; stroke: number; dash?: number[] } | null
> = {
  none: null,
  normal: { radius: (b) => Math.min(b.height / 2.2, 48), stroke: 3 },
  shout: { radius: () => 8, stroke: 4 },
  spike: { radius: () => 4, stroke: 4 },
  whisper: { radius: (b) => Math.min(b.height / 2.2, 48), stroke: 2, dash: [12, 8] },
  thought: { radius: (b) => b.height / 2, stroke: 3 },
  cloud: { radius: (b) => b.height / 2, stroke: 3 },
  telepathy: { radius: (b) => b.height / 2, stroke: 2, dash: [4, 6] },
  broadcast: { radius: () => 6, stroke: 3, dash: [16, 6] },
  wobble: { radius: (b) => Math.min(b.height / 3, 32), stroke: 3 },
  chain: { radius: (b) => Math.min(b.height / 2.2, 48), stroke: 3 },
  narration_box: { radius: () => 6, stroke: 1.5 },
};

/** konva 는 HTMLImageElement 를 받는다. data URI 든 서명 URL 이든 같다. */
function useHtmlImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.src = src;
    const done = () => setImage(el);
    el.addEventListener("load", done);
    return () => {
      el.removeEventListener("load", done);
      setImage(null);
    };
  }, [src]);

  return image;
}

export type { Layer };
