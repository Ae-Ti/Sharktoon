"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Badge, Button, Field, LayerRow, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CREDIT_COST } from "@/contracts/credit";
import type { GenerationJob } from "@/contracts/generation";
import {
  BALLOON_LABEL,
  isVectorTextLayer,
  toLayerRowProps,
  type BalloonKind,
  type CutLayerTree,
  type Layer,
  type VectorTextLayer,
} from "../types/layer";
import { useEditor } from "../editor/useEditor";
import { useMeasuredSize } from "../editor/useMeasuredSize";
import { EpisodeHeader } from "./EpisodeHeader";

/**
 * konva 는 window 를 쓴다. 서버에서 그릴 수 없으므로 클라이언트에서만 불러온다.
 * 페이지 나머지(패널·툴바)는 그대로 SSR 된다.
 */
const EditorCanvas = dynamic(
  () => import("../editor/EditorCanvas").then((m) => m.EditorCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="grid aspect-square w-full max-w-[720px] place-items-center rounded-lg bg-canvas-grid text-caption text-ink-subtle">
        캔버스 준비 중
      </div>
    ),
  },
);

const SAVE_LABEL = {
  idle: "",
  dirty: "저장 대기 중",
  saving: "저장 중",
  saved: "저장됨",
  error: "저장 실패 — 다음 변경에서 다시 시도해요",
} as const;

export interface CutEditorScreenProps {
  job: GenerationJob;
  tree: CutLayerTree;
  /** ImageGenerator.supportsInpainting(). 꺼져 있으면 부분 재생성 UI 를 아예 감춘다. */
  supportsInpainting?: boolean;
  seriesTitle: string;
  episodeTitle: string;
}

/** PRD 3.2 — 레이어 기반 컷 편집기. */
export function CutEditorScreen({
  job,
  tree: initialTree,
  supportsInpainting = false,
  seriesTitle,
  episodeTitle,
}: CutEditorScreenProps) {
  const [openCutId, setOpenCutId] = useState(initialTree.cutId);
  const [confirmDelete, setConfirmDelete] = useState<Layer | null>(null);
  const { ref: canvasBox, size } = useMeasuredSize<HTMLDivElement>();

  const editor = useEditor({ initial: initialTree });
  const { tree, selected, selectedId } = editor;

  // 위에 그려지는 레이어가 목록 맨 위로 오도록 뒤집는다. z 순서와 목록 순서가 반대다.
  const rows = [...tree.layers].reverse();

  return (
    <div className="flex min-h-dvh flex-col bg-surface-page">
      <EpisodeHeader
        episodeId={job.episodeId}
        seriesTitle={seriesTitle}
        episodeTitle={episodeTitle}
        current="editor"
        credits={12}
        action={<Button size="sm">게시물로 내보내기</Button>}
      />

      <Toolbar
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onAddText={() => editor.add(newTextLayer(tree, "text"))}
        onAddBalloon={() => editor.add(newTextLayer(tree, "balloon"))}
        onAddSfx={() => editor.add(newTextLayer(tree, "sfx"))}
        saveLabel={SAVE_LABEL[editor.saveState]}
        saveError={editor.saveState === "error"}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[132px_minmax(0,1fr)_320px]">
        <CutStrip cuts={job.cuts} openCutId={openCutId} onOpen={setOpenCutId} />

        <section
          ref={canvasBox}
          aria-label="캔버스"
          className="grid min-h-[320px] place-items-center overflow-hidden rounded-xl border border-border bg-surface-sunken p-4"
        >
          {size > 0 && (
            <EditorCanvas
              tree={tree}
              selectedId={selectedId}
              size={size}
              onSelect={editor.setSelectedId}
              onBeginDrag={editor.beginDrag}
              onPreviewBox={editor.previewBox}
              onCommit={editor.commitDrag}
            />
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <Panel title="레이어" caption="위에 있는 것이 앞에 그려져요.">
            <div role="listbox" aria-label="레이어" className="flex flex-col">
              {rows.map((layer, rowIndex) => {
                const z = tree.layers.length - 1 - rowIndex;
                return (
                  <div key={layer.id} className="group flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <LayerRow
                        {...toLayerRowProps(layer)}
                        selected={layer.id === selectedId}
                        onSelect={() => editor.setSelectedId(layer.id)}
                        onToggle={() =>
                          editor.update(layer.id, (l) => ({ ...l, hidden: !l.hidden }))
                        }
                      />
                    </div>
                    <OrderButtons
                      canUp={z < tree.layers.length - 1}
                      canDown={z > 0}
                      onUp={() => editor.reorder(z, z + 1)}
                      onDown={() => editor.reorder(z, z - 1)}
                    />
                  </div>
                );
              })}
            </div>
          </Panel>

          {selected && (
            <LayerInspector
              layer={selected}
              onChangeText={(text) =>
                editor.update(selected.id, (l) =>
                  isVectorTextLayer(l) ? { ...l, text } : l,
                )
              }
              onChangeBalloon={(balloon) =>
                editor.update(selected.id, (l) =>
                  isVectorTextLayer(l) ? { ...l, balloon } : l,
                )
              }
              onChangeFontSize={(fontSize) =>
                editor.update(selected.id, (l) =>
                  isVectorTextLayer(l)
                    ? { ...l, style: { ...l.style, fontSize } }
                    : l,
                )
              }
              onToggleLock={() =>
                editor.update(selected.id, (l) => ({ ...l, locked: !l.locked }))
              }
              onDelete={() => setConfirmDelete(selected)}
            />
          )}

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

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="이 레이어를 지울까요?"
        description={
          confirmDelete
            ? `"${confirmDelete.name}" 을 지웁니다. 실행 취소로 되돌릴 수 있어요.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              그대로 두기
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) editor.remove(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              지우기
            </Button>
          </>
        }
      />
    </div>
  );
}

function Toolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddText,
  onAddBalloon,
  onAddSfx,
  saveLabel,
  saveError,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddText: () => void;
  onAddBalloon: () => void;
  onAddSfx: () => void;
  saveLabel: string;
  saveError: boolean;
}) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-border bg-surface-card px-4">
      <ToolButton label="실행 취소" onClick={onUndo} disabled={!canUndo}>
        ↶
      </ToolButton>
      <ToolButton label="다시 실행" onClick={onRedo} disabled={!canRedo}>
        ↷
      </ToolButton>
      <span className="mx-2 h-5 w-px bg-border" />
      <ToolButton label="텍스트 추가" onClick={onAddText}>
        T
      </ToolButton>
      <ToolButton label="말풍선 추가" onClick={onAddBalloon}>
        ◗
      </ToolButton>
      <ToolButton label="효과음 추가" onClick={onAddSfx}>
        ✺
      </ToolButton>

      <span className="ml-auto flex items-center gap-3">
        {/* 자동 저장은 3초 디바운스다(PRD 성능). 저장 버튼을 따로 두지 않는다. */}
        <span
          aria-live="polite"
          className={cn("text-caption", saveError ? "text-danger" : "text-ink-subtle")}
        >
          {saveLabel}
        </span>
        <Badge tone="ai">AI 생성</Badge>
      </span>
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-control-sm cursor-pointer place-items-center rounded-md text-label text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function OrderButtons({
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <span className="flex shrink-0 flex-col opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        aria-label="앞으로"
        disabled={!canUp}
        onClick={onUp}
        className="cursor-pointer px-1 text-[11px] text-ink-muted hover:text-ink disabled:opacity-30"
      >
        ▲
      </button>
      <button
        type="button"
        aria-label="뒤로"
        disabled={!canDown}
        onClick={onDown}
        className="cursor-pointer px-1 text-[11px] text-ink-muted hover:text-ink disabled:opacity-30"
      >
        ▼
      </button>
    </span>
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

/** 말풍선 고르기는 12종을 다 보여준다(PRD 3.2). 드롭다운에 숨기면 안 쓴다. */
const BALLOON_ORDER: BalloonKind[] = [
  "normal",
  "thought",
  "shout",
  "whisper",
  "narration_box",
  "telepathy",
  "broadcast",
  "wobble",
  "spike",
  "cloud",
  "chain",
  "none",
];

function LayerInspector({
  layer,
  onChangeText,
  onChangeBalloon,
  onChangeFontSize,
  onToggleLock,
  onDelete,
}: {
  layer: Layer;
  onChangeText: (text: string) => void;
  onChangeBalloon: (balloon: BalloonKind) => void;
  onChangeFontSize: (size: number) => void;
  onToggleLock: () => void;
  onDelete: () => void;
}) {
  const vector = isVectorTextLayer(layer) ? (layer as VectorTextLayer) : null;

  return (
    <Panel title={layer.name}>
      {vector ? (
        <div className="flex flex-col gap-3">
          <Field
            label="글"
            multiline
            rows={2}
            value={vector.text}
            onChange={onChangeText}
            maxLength={120}
          />

          <div className="flex flex-col gap-2">
            <span className="text-label font-semibold text-ink">말풍선</span>
            <div className="flex flex-wrap gap-1">
              {BALLOON_ORDER.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onChangeBalloon(kind)}
                  aria-pressed={vector.balloon === kind}
                  className={cn(
                    "h-control-sm cursor-pointer rounded-md px-2.5 text-caption font-semibold",
                    vector.balloon === kind
                      ? "bg-brand text-on-brand"
                      : "bg-surface-sunken text-ink-muted hover:text-ink",
                  )}
                >
                  {BALLOON_LABEL[kind]}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 text-label">
            <span className="shrink-0 text-ink-muted">크기</span>
            <input
              type="range"
              min={16}
              max={96}
              value={vector.style.fontSize}
              onChange={(e) => onChangeFontSize(Number(e.target.value))}
              className="h-control-sm min-w-0 flex-1 accent-brand"
            />
            <span className="w-10 shrink-0 text-right font-semibold tabular-nums">
              {vector.style.fontSize}
            </span>
          </label>

          <p className="text-caption text-ink-subtle">
            벡터라 이미지에 굽지 않아요. 나중에 글자만 고칠 수 있어요.
          </p>
        </div>
      ) : (
        <dl className="flex flex-col gap-2 text-label">
          <Row label="종류">생성 이미지</Row>
          <Row label="크기">
            {Math.round(layer.box.width)} × {Math.round(layer.box.height)}
          </Row>
        </dl>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onToggleLock}>
          {layer.locked ? "잠금 풀기" : "잠그기"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} disabled={layer.locked}>
          지우기
        </Button>
      </div>
    </Panel>
  );
}

/** 새 벡터 레이어. 캔버스 가운데에 놓아서 바로 보이게 한다. */
function newTextLayer(
  tree: CutLayerTree,
  kind: "text" | "balloon" | "sfx",
): VectorTextLayer {
  const width = Math.round(tree.canvas.width * 0.44);
  const height = Math.round(tree.canvas.height * 0.14);
  const preset = {
    text: { name: "텍스트", text: "여기에 글", balloon: "none" as const, size: 38 },
    balloon: { name: "말풍선", text: "대사를 적어요", balloon: "normal" as const, size: 38 },
    sfx: { name: "효과음", text: "쾅", balloon: "none" as const, size: 72 },
  }[kind];

  return {
    id: `ly_${kind}_${Date.now().toString(36)}`,
    name: preset.name,
    kind,
    box: {
      x: Math.round((tree.canvas.width - width) / 2),
      y: Math.round((tree.canvas.height - height) / 2),
      width,
      height,
    },
    text: preset.text,
    balloon: preset.balloon,
    style: {
      fontFamily: "Gaegu",
      fontSize: preset.size,
      lineHeight: 1.4,
      align: "center",
      color: "#121820",
      bold: kind === "sfx",
    },
  };
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
