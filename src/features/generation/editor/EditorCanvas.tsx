"use client";

import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer as KonvaLayer,
  Image as KonvaImage,
  Text,
  Rect,
  Line,
  Circle,
  Transformer,
} from "react-konva";
import Konva from "konva";
import {
  isVectorTextLayer,
  type CutLayerTree,
  type ImageLayer,
  type Layer,
  type LayerBox,
  type VectorTextLayer,
} from "../types/layer";
import { bodyConfig, tailConfigs, textConfig } from "./nodeConfig";
import { ensureToonFont } from "./fonts";

// 두 손가락 확대 중에도 노드 판정이 돌아야 핀치가 끊기지 않는다(konva 다중 터치 안내).
Konva.hitOnDragEnabled = true;

export interface EditorCanvasProps {
  tree: CutLayerTree;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** 조작 시작. 이 시점의 상태가 이력의 "이전 칸"이 된다. */
  onBeginDrag: () => void;
  /** 드래그·리사이즈 중. 이력에 쌓이지 않는다. */
  onPreviewBox: (id: string, box: Partial<LayerBox>) => void;
  /** 말풍선 꼬리 끝점을 끄는 중. */
  onPreviewTail: (id: string, tail: { x: number; y: number }) => void;
  /** 조작 끝. 이력 한 칸이 된다. */
  onCommit: () => void;
  /** 캔버스가 차지할 화면 폭(px). 부모가 재어서 준다. */
  size: number;
}

/** 스냅 거리(화면 px). 캔버스 배율로 나눠 원본 좌표로 바꾼다. */
const SNAP_PX = 8;
const GUIDE = "#0f6f7d";
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * 컷 편집 캔버스 — PRD 3.2.
 *
 * 좌표는 전부 컷 이미지 원본 픽셀(1080)로 들고, 화면 배율은 Stage 의 scale 로만 준다.
 * 이렇게 해야 확대해도 레이어 값이 안 흔들리고, 내보낼 때 원본 배율로 그대로 그린다.
 * 확대(핀치·Ctrl+휠)는 보기 배율(zoom)이라 레이어 값에 닿지 않는다.
 */
export function EditorCanvas({
  tree,
  selectedId,
  onSelect,
  onBeginDrag,
  onPreviewBox,
  onPreviewTail,
  onCommit,
  size,
}: EditorCanvasProps) {
  const fit = size / tree.canvas.width;
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const scale = fit * view.zoom;

  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const pinch = useRef<{ dist: number; center: { x: number; y: number } } | null>(null);
  const fontEpoch = useFontEpoch(tree);

  // 선택이 바뀌면 변형 핸들을 그 노드에 붙인다.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, tree.layers, fontEpoch]);

  function register(id: string, node: Konva.Node | null) {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }

  /** 캔버스 중앙·가장자리와 다른 레이어의 변·중심에 붙인다. */
  function snap(id: string, node: Konva.Node) {
    const threshold = SNAP_PX / scale;
    const w = node.width();
    const h = node.height();
    const targetsX = [0, tree.canvas.width / 2, tree.canvas.width];
    const targetsY = [0, tree.canvas.height / 2, tree.canvas.height];
    for (const l of tree.layers) {
      if (l.id === id || l.hidden || l.kind === "background") continue;
      targetsX.push(l.box.x, l.box.x + l.box.width / 2, l.box.x + l.box.width);
      targetsY.push(l.box.y, l.box.y + l.box.height / 2, l.box.y + l.box.height);
    }

    const pick = (pos: number, len: number, targets: number[]) => {
      let best: { pos: number; line: number; d: number } | null = null;
      for (const offset of [0, len / 2, len]) {
        for (const t of targets) {
          const d = Math.abs(pos + offset - t);
          if (d <= threshold && (!best || d < best.d)) best = { pos: t - offset, line: t, d };
        }
      }
      return best;
    };

    // 회전한 레이어는 변이 축과 맞지 않으므로 붙이지 않는다.
    if (node.rotation() !== 0) {
      setGuides({ v: [], h: [] });
      return;
    }
    const sx = pick(node.x(), w, targetsX);
    const sy = pick(node.y(), h, targetsY);
    if (sx) node.x(sx.pos);
    if (sy) node.y(sy.pos);
    setGuides({ v: sx ? [sx.line] : [], h: sy ? [sy.line] : [] });
  }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    // 그냥 휠은 페이지 스크롤이다. Ctrl(트랙패드 핀치) 일 때만 확대한다.
    if (!e.evt.ctrlKey) return;
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    zoomAt(pointer, view.zoom * (e.evt.deltaY > 0 ? 0.92 : 1.08));
  }

  function zoomAt(point: { x: number; y: number }, nextZoom: number) {
    setView((v) => {
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
      const oldScale = fit * v.zoom;
      const newScale = fit * zoom;
      const worldX = (point.x - v.x) / oldScale;
      const worldY = (point.y - v.y) / oldScale;
      return clampView({ zoom, x: point.x - worldX * newScale, y: point.y - worldY * newScale });
    });
  }

  function clampView(v: { zoom: number; x: number; y: number }) {
    if (v.zoom <= MIN_ZOOM) return { zoom: 1, x: 0, y: 0 };
    const W = size;
    const H = size * (tree.canvas.height / tree.canvas.width);
    const minX = W - W * v.zoom;
    const minY = H - H * v.zoom;
    return { zoom: v.zoom, x: Math.min(0, Math.max(minX, v.x)), y: Math.min(0, Math.max(minY, v.y)) };
  }

  function onTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches;
    if (touches.length !== 2) return;
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    // 한 손가락으로 끌던 레이어가 있으면 놓는다. 핀치는 보기 조작이다.
    for (const node of nodeRefs.current.values()) if (node.isDragging()) node.stopDrag();

    const rect = stage.container().getBoundingClientRect();
    const p1 = { x: touches[0].clientX - rect.left, y: touches[0].clientY - rect.top };
    const p2 = { x: touches[1].clientX - rect.left, y: touches[1].clientY - rect.top };
    const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

    const prev = pinch.current;
    pinch.current = { dist, center };
    if (!prev) return;
    setView((v) => {
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * (dist / prev.dist)));
      const oldScale = fit * v.zoom;
      const newScale = fit * zoom;
      const worldX = (prev.center.x - v.x) / oldScale;
      const worldY = (prev.center.y - v.y) / oldScale;
      return clampView({
        zoom,
        x: center.x - worldX * newScale,
        y: center.y - worldY * newScale,
      });
    });
  }

  const selected = tree.layers.find((l) => l.id === selectedId) ?? null;
  const tailHandle =
    selected && isVectorTextLayer(selected) && selected.tail && !selected.locked
      ? selected
      : null;

  return (
    <div className="relative">
      <Stage
        width={size}
        height={size * (tree.canvas.height / tree.canvas.width)}
        scale={{ x: scale, y: scale }}
        x={view.x}
        y={view.y}
        onWheel={onWheel}
        onTouchMove={onTouchMove}
        onTouchEnd={() => {
          pinch.current = null;
        }}
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
              draggable: !layer.locked,
              onMouseDown: () => onSelect(layer.id),
              onTouchStart: () => onSelect(layer.id),
              onDragStart: onBeginDrag,
              onTransformStart: onBeginDrag,
              onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
                snap(layer.id, e.target);
                onPreviewBox(layer.id, { x: e.target.x(), y: e.target.y() });
              },
              onDragEnd: () => {
                setGuides({ v: [], h: [] });
                onCommit();
              },
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
                key={`${layer.id}:${fontEpoch}`}
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

          {guides.v.map((x) => (
            <Line
              key={`v${x}`}
              points={[x, 0, x, tree.canvas.height]}
              stroke={GUIDE}
              strokeWidth={1 / scale}
              dash={[6 / scale, 4 / scale]}
              listening={false}
            />
          ))}
          {guides.h.map((y) => (
            <Line
              key={`h${y}`}
              points={[0, y, tree.canvas.width, y]}
              stroke={GUIDE}
              strokeWidth={1 / scale}
              dash={[6 / scale, 4 / scale]}
              listening={false}
            />
          ))}

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

          {tailHandle && (
            <Circle
              x={tailHandle.tail!.x}
              y={tailHandle.tail!.y}
              radius={10 / scale}
              fill="#ffffff"
              stroke={GUIDE}
              strokeWidth={2 / scale}
              // 손가락으로 잡을 수 있게 판정 영역을 넓힌다.
              hitStrokeWidth={24 / scale}
              draggable
              onDragStart={onBeginDrag}
              onDragMove={(e) =>
                onPreviewTail(tailHandle.id, { x: e.target.x(), y: e.target.y() })
              }
              onDragEnd={onCommit}
            />
          )}
        </KonvaLayer>
      </Stage>

      {view.zoom > 1 && (
        <button
          type="button"
          onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
          className="absolute right-2 bottom-2 h-control-sm cursor-pointer rounded-md bg-surface-card px-3 text-caption font-semibold text-ink shadow"
        >
          {Math.round(view.zoom * 100)}% · 맞추기
        </button>
      )}
    </div>
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
      x={layer.box.x}
      y={layer.box.y}
      width={layer.box.width}
      height={layer.box.height}
      rotation={layer.box.rotation ?? 0}
      opacity={layer.opacity ?? 1}
      image={image}
      ref={(node) => register(layer.id, node)}
    />
  );
}

/**
 * 말풍선·텍스트·나레이션·효과음. 이미지에 굽지 않으므로 konva 도형과 텍스트로 그린다.
 * 모양은 nodeConfig 가 정한다 — 내보내기 렌더러와 같은 값이다.
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
  const body = bodyConfig(layer);
  const tail = tailConfigs(layer);

  return (
    <>
      {body && <Rect {...body} />}
      {tail?.kind === "wedge" && (
        <>
          <Line {...tail.fill} />
          <Line {...tail.outline} />
        </>
      )}
      {tail?.kind === "bubbles" && tail.circles.map((c, i) => <Circle key={i} {...c} />)}
      <Text {...textConfig(layer)} {...common} ref={(node) => register(layer.id, node)} />
    </>
  );
}

/**
 * 트리에 쓰인 글꼴을 싣고, 다 받으면 숫자를 올린다. 텍스트 노드는 이 숫자를 key 에 넣어
 * 다시 그려진다 — konva 는 글꼴이 오기 전에 잰 글자 폭을 들고 있기 때문이다.
 */
function useFontEpoch(tree: CutLayerTree): number {
  const families = [
    ...new Set(tree.layers.filter(isVectorTextLayer).map((l) => l.style.fontFamily)),
  ].join("|");
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all(families.split("|").filter(Boolean).map(ensureToonFont)).then(() => {
      if (!cancelled) setEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [families]);

  return epoch;
}

/** konva 는 HTMLImageElement 를 받는다. data URI 든 서명 URL 이든 같다. */
function useHtmlImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) return;
    const el = new window.Image();
    // 내보내기에서 캔버스를 PNG 로 뽑으려면 교차 출처 이미지가 CORS 를 통과해야 한다.
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
