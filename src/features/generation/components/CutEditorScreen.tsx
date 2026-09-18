"use client";

import { useState } from "react";
import { Badge, Button, LayerRow } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CREDIT_COST } from "@/contracts/credit";
import type { GenerationJob } from "@/contracts/generation";
import {
  BALLOON_LABEL,
  isVectorTextLayer,
  toLayerRowProps,
  type CutLayerTree,
  type Layer,
  type VectorTextLayer,
} from "../types/layer";
import { EpisodeHeader } from "./EpisodeHeader";

export interface CutEditorScreenProps {
  job: GenerationJob;
  tree: CutLayerTree;
  /** ImageGenerator.supportsInpainting(). 꺼져 있으면 부분 재생성 UI 를 아예 감춘다. */
  supportsInpainting?: boolean;
}

/**
 * PRD 3.2 — 레이어 기반 컷 편집기. 이번 목업은 정적 레이아웃까지다.
 *
 * 캔버스는 레이어 트리를 그려서 보여주기만 하고 끌거나 크기를 바꾸지 않는다.
 * 핸들·마스크 브러시·스냅 가이드는 react-konva 로 실제 인터랙션을 만들면서 정한다(디자인 가이드).
 */
export function CutEditorScreen({
  job,
  tree,
  supportsInpainting = false,
}: CutEditorScreenProps) {
  const [openCutId, setOpenCutId] = useState(tree.cutId);
  const [selectedId, setSelectedId] = useState<string | null>("ly_balloon");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const selected = tree.layers.find((l) => l.id === selectedId) ?? null;
  // 위에 그려지는 레이어가 목록 맨 위로 오도록 뒤집는다. z 순서와 목록 순서가 반대다.
  const rows = [...tree.layers].reverse();

  return (
    <div className="flex min-h-dvh flex-col bg-surface-page">
      <EpisodeHeader
        episodeId={job.episodeId}
        seriesTitle="퇴근길 기록"
        episodeTitle="1화 · 퇴근 10분 전"
        current="editor"
        credits={12}
        action={
          <Button size="sm">게시물로 내보내기</Button>
        }
      />

      <Toolbar />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[132px_minmax(0,1fr)_320px]">
        <CutStrip
          cuts={job.cuts}
          openCutId={openCutId}
          onOpen={setOpenCutId}
        />

        <section
          aria-label="캔버스"
          className="grid min-h-0 place-items-center rounded-xl border border-border bg-surface-sunken p-6"
        >
          <Canvas tree={tree} selectedId={selectedId} hidden={hidden} />
        </section>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <Panel title="레이어" caption="위에 있는 것이 앞에 그려져요.">
            <div role="listbox" aria-label="레이어" className="flex flex-col">
              {rows.map((layer) => (
                <LayerRow
                  key={layer.id}
                  {...toLayerRowProps(layer)}
                  hidden={hidden[layer.id]}
                  selected={layer.id === selectedId}
                  onSelect={() => setSelectedId(layer.id)}
                  onToggle={() =>
                    setHidden((h) => ({ ...h, [layer.id]: !h[layer.id] }))
                  }
                />
              ))}
            </div>
          </Panel>

          {selected && <LayerInspector layer={selected} />}

          <Panel
            title="부분만 다시 만들기"
            caption="컷을 통째로 다시 뽑지 않아요. 크레딧이 절반만 들어요."
          >
            {supportsInpainting ? (
              <div className="flex flex-col gap-3">
                <div className="grid h-24 place-items-center rounded-lg border border-dashed border-border-control bg-surface-sunken text-caption text-ink-muted">
                  캔버스에서 고칠 영역을 칠하세요
                </div>
                <Button variant="secondary" cost={CREDIT_COST.partialRegenerate} block>
                  칠한 곳만 다시
                </Button>
              </div>
            ) : (
              <p className="text-body-sm text-ink-muted">
                모델 검증(오픈 이슈 3)이 끝나면 열려요. 지금은 생성 화면의 한 컷 모드에서
                표정·배경만 바꿀 수 있어요.
              </p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Toolbar() {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-border bg-surface-card px-4">
      <ToolButton label="실행 취소">↶</ToolButton>
      <ToolButton label="다시 실행">↷</ToolButton>
      <span className="mx-2 h-5 w-px bg-border" />
      <ToolButton label="텍스트 추가">T</ToolButton>
      <ToolButton label="말풍선 추가">◗</ToolButton>
      <ToolButton label="효과음 추가">✺</ToolButton>

      <span className="ml-auto flex items-center gap-3">
        {/* 자동 저장은 3초 디바운스다(PRD 성능). 저장 버튼을 따로 두지 않는다. */}
        <span className="text-caption text-ink-subtle">방금 저장됨</span>
        <Badge tone="ai">AI 생성</Badge>
      </span>
    </div>
  );
}

function ToolButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid size-control-sm cursor-pointer place-items-center rounded-md text-label text-ink-muted hover:bg-surface-sunken hover:text-ink"
    >
      {children}
    </button>
  );
}

function CutStrip({
  cuts,
  openCutId,
  onOpen,
}: {
  cuts: GenerationJob["cuts"];
  openCutId: string;
  onOpen: (cutId: string) => void;
}) {
  return (
    <nav
      aria-label="컷"
      className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-x-visible lg:overflow-y-auto"
    >
      {cuts.map((cut) => {
        const open = cut.cutId === openCutId;
        const ready = cut.status === "done" && cut.imageUrl;
        return (
          <button
            key={cut.cutId}
            type="button"
            disabled={!ready}
            aria-current={open ? "true" : undefined}
            onClick={() => onOpen(cut.cutId)}
            className={cn(
              "relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg border lg:w-full",
              ready ? "cursor-pointer" : "cursor-default bg-skeleton",
              open ? "border-2 border-brand" : "border-border",
            )}
          >
            {ready ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cut.imageUrl} alt={`${cut.index}컷`} className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-caption text-ink-subtle">
                {cut.status === "failed" ? "실패" : "생성 중"}
              </span>
            )}
            <span className="absolute top-1 left-1.5 text-[11px] font-bold text-ink-inverse mix-blend-difference">
              {cut.index}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * 레이어 트리를 원본 좌표 그대로 퍼센트로 환산해 그린다.
 * 캔버스 크기가 바뀌어도 레이어 위치 계산이 한 곳에만 있게 한다.
 */
function Canvas({
  tree,
  selectedId,
  hidden,
}: {
  tree: CutLayerTree;
  selectedId: string | null;
  hidden: Record<string, boolean>;
}) {
  const pct = (v: number, axis: "x" | "y") =>
    `${(v / (axis === "x" ? tree.canvas.width : tree.canvas.height)) * 100}%`;

  return (
    <div
      className="relative aspect-square w-full max-w-[600px] overflow-hidden rounded-lg bg-canvas-grid shadow-md"
      style={{ containerType: "inline-size" }}
    >
      {tree.layers.map((layer) => {
        if (hidden[layer.id]) return null;
        const style: React.CSSProperties = {
          left: pct(layer.box.x, "x"),
          top: pct(layer.box.y, "y"),
          width: pct(layer.box.width, "x"),
          height: pct(layer.box.height, "y"),
          transform: layer.box.rotation ? `rotate(${layer.box.rotation}deg)` : undefined,
          opacity: layer.opacity,
        };

        return (
          <div
            key={layer.id}
            style={style}
            className={cn(
              "absolute",
              layer.id === selectedId &&
                "outline-2 outline-offset-1 outline-brand outline-dashed",
            )}
          >
            {isVectorTextLayer(layer) ? (
              <VectorLayerView layer={layer} canvasWidth={tree.canvas.width} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={layer.imageUrl}
                alt={layer.name}
                className="size-full object-cover"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 벡터 레이어는 이미지에 굽지 않으므로 캔버스에서도 DOM 으로 그린다. */
function VectorLayerView({
  layer,
  canvasWidth,
}: {
  layer: VectorTextLayer;
  canvasWidth: number;
}) {
  // 원본 픽셀 크기를 캔버스 폭 기준 컨테이너 단위로 환산한다. 줌해도 글자 비율이 유지된다.
  const fontSize = `${(layer.style.fontSize / canvasWidth) * 100}cqw`;

  const shape =
    layer.balloon === "none"
      ? ""
      : layer.balloon === "thought"
        ? "rounded-[50%] border border-ink bg-surface-card"
        : layer.balloon === "whisper"
          ? "rounded-xl border border-dashed border-ink bg-surface-card"
          : layer.balloon === "narration_box"
            ? "rounded-md border border-ink/30 bg-surface-card/90"
            : "rounded-xl border-2 border-ink bg-surface-card";

  return (
    <div
      className={cn("grid size-full place-items-center px-[6%]", shape)}
      style={{
        fontFamily: layer.style.fontFamily,
        fontSize,
        lineHeight: layer.style.lineHeight,
        fontWeight: layer.style.bold ? 800 : 500,
        textAlign: layer.style.align,
        color: layer.style.color,
        WebkitTextStroke: layer.style.strokeWidth
          ? `${layer.style.strokeWidth / 10}px ${layer.style.strokeColor}`
          : undefined,
        paintOrder: "stroke fill",
      }}
    >
      {layer.text}
    </div>
  );
}

function LayerInspector({ layer }: { layer: Layer }) {
  return (
    <Panel title={layer.name}>
      <dl className="flex flex-col gap-2 text-label">
        <Row label="종류">
          {isVectorTextLayer(layer) ? "벡터 · 이미지에 굽지 않음" : "생성 이미지"}
        </Row>
        {isVectorTextLayer(layer) ? (
          <>
            <Row label="말풍선">{BALLOON_LABEL[layer.balloon]}</Row>
            <Row label="글꼴">{layer.style.fontFamily}</Row>
            <Row label="크기">{layer.style.fontSize}px</Row>
            {layer.kind === "narration" && (
              <Row label="시리즈 스타일">
                {layer.overridesSeriesStyle ? "이 컷만 덮어씀" : "따름"}
              </Row>
            )}
          </>
        ) : (
          <Row label="잠금">{layer.locked ? "잠김" : "풀림"}</Row>
        )}
        <Row label="위치">
          {Math.round(layer.box.x)}, {Math.round(layer.box.y)}
        </Row>
      </dl>
    </Panel>
  );
}

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="truncate text-label font-semibold text-ink">{title}</h2>
        {caption && <p className="text-caption text-ink-muted">{caption}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="truncate text-right font-semibold text-ink">{children}</dd>
    </div>
  );
}
