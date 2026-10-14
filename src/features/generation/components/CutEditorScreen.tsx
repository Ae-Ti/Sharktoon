"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Badge, Button, ButtonLink, Field, LayerRow, Modal } from "@/components/ui";
import { WebtoonComicViewer } from "@/components/ui/WebtoonComicViewer";
import { cn } from "@/lib/cn";
import { deleteCutAction, saveLayerTreeAction } from "../actions";
import { TOON_FONTS, ensureToonFont } from "../editor/fonts";
import {
  isVectorTextLayer,
  toLayerRowProps,
  type CutLayerTree,
  type Layer,
  type VectorTextLayer,
} from "../types/layer";
import { useEditor } from "../editor/useEditor";
import { useMeasuredSize } from "../editor/useMeasuredSize";
import {
  buildLayerFromPreset,
  type ElementPresetId,
} from "../editor/ElementPalette";
import { motion } from "framer-motion";
import {
  Undo2,
  Redo2,
  MessageSquare,
  Scroll,
  Cloud,
  Flame,
  Zap,
  Type,
  PanelBottom,
  Heading,
  Sparkles,
  ChevronUp,
  ChevronDown,
  BookOpen,
  Trash2,
} from "lucide-react";
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

export interface EditorStripCut {
  cutId: string;
  index: number;
  imageUrl: string | null;
}

export interface CutEditorScreenProps {
  episodeId: string;
  jobId?: string | null;
  cuts: EditorStripCut[];
  tree: CutLayerTree;
  credits: number;
  seriesTitle: string;
  episodeTitle: string;
}

/** PRD 3.2 — 레이어 기반 컷 편집기. */
export function CutEditorScreen({
  episodeId,
  jobId: _jobId,
  cuts,
  tree: initialTree,
  credits,
  seriesTitle,
  episodeTitle,
}: CutEditorScreenProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<Layer | null>(null);
  const [cutToDelete, setCutToDelete] = useState<EditorStripCut | null>(null);
  const [isDeletingCut, setIsDeletingCut] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  async function handleConfirmDeleteCut() {
    if (!cutToDelete) return;
    setIsDeletingCut(true);
    const res = await deleteCutAction({ episodeId, cutId: cutToDelete.cutId });
    setIsDeletingCut(false);
    if (res.ok) {
      const remaining = cuts.filter((c) => c.cutId !== cutToDelete.cutId);
      setCutToDelete(null);
      if (remaining.length > 0) {
        router.push(`/episodes/${episodeId}/editor?cut=${remaining[0].cutId}`);
      }
      router.refresh();
    } else {
      alert(res.message);
    }
  }

  // 캔버스와 컷의 실제 규격(1:1 또는 4:5)을 정확히 유지하여 세로 왜곡/늘어남 방지
  const canvasW = initialTree.canvas?.width || 1080;
  const canvasH = initialTree.canvas?.height || 1080;
  const canvasRatio = canvasH / canvasW;

  const normalizedTree = useMemo<CutLayerTree>(() => {
    return {
      ...initialTree,
      canvas: { width: canvasW, height: canvasH },
      layers: initialTree.layers.map((l) => {
        if (l.kind === "background") {
          return { ...l, box: { ...l.box, x: 0, y: 0, width: canvasW, height: canvasH } };
        }
        return l;
      }),
    };
  }, [initialTree, canvasW, canvasH]);

  const { ref: canvasBox, size } = useMeasuredSize<HTMLDivElement>(canvasRatio);

  // 자동 저장. 실패하면 던져서 툴바에 "저장 실패"가 뜨게 한다.
  const save = useCallback(
    async (tree: CutLayerTree) => {
      const r = await saveLayerTreeAction({ episodeId, tree });
      if (!r.ok) throw new Error(r.message);
    },
    [episodeId],
  );
  const editor = useEditor({ initial: normalizedTree, save });
  const { tree, selected, selectedId } = editor;

  // 위에 그려지는 레이어가 목록 맨 위로 오도록 뒤집는다. z 순서와 목록 순서가 반대다.
  const rows = [...tree.layers].reverse();

  const handleAddPreset = useCallback(
    (presetId: ElementPresetId) => {
      const layer = buildLayerFromPreset(tree, presetId);
      editor.add(layer);
      editor.setSelectedId(layer.id);
    },
    [editor, tree],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-surface-page">
      <EpisodeHeader
        episodeId={episodeId}
        seriesTitle={seriesTitle}
        episodeTitle={episodeTitle}
        current="editor"
        credits={credits}
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setViewerOpen(true)}
            >
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              웹툰 뷰어
            </Button>
            <ButtonLink href={`/episodes/${episodeId}/publish`} size="sm">
              게시물로 내보내기
            </ButtonLink>
          </div>
        }
      />

      <Toolbar
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onAddPreset={handleAddPreset}
        saveLabel={SAVE_LABEL[editor.saveState]}
        saveError={editor.saveState === "error"}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[132px_minmax(0,1fr)_340px]">
        <CutStrip
          cuts={cuts}
          openCutId={initialTree.cutId}
          isPortrait={canvasH > canvasW}
          // 페이지가 그 컷의 트리를 읽어 새로 그린다. 떠나는 컷은 useEditor 가 바로 저장한다.
          onOpen={(cutId) => router.push(`/episodes/${episodeId}/editor?cut=${cutId}`)}
          onDeleteCut={(c) => setCutToDelete(c)}
        />

        <section
          ref={canvasBox}
          aria-label="캔버스"
          className="relative grid min-h-[320px] place-items-center overflow-hidden rounded-2xl border border-border/80 bg-surface-sunken p-4 shadow-inner"
        >
          {size > 0 && (
            <EditorCanvas
              tree={tree}
              selectedId={selectedId}
              size={size}
              onSelect={editor.setSelectedId}
              onBeginDrag={editor.beginDrag}
              onPreviewBox={editor.previewBox}
              onPreviewTail={editor.previewTail}
              onCommit={editor.commitDrag}
            />
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <Panel
            title={`레이어 (${rows.length})`}
            caption="위에 있는 것이 앞에 그려져요. 추가는 상단 툴바에서 해요."
          >
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
              onChangeName={(name) =>
                editor.update(selected.id, (l) => ({ ...l, name }))
              }
              onChangeText={(text) =>
                editor.update(selected.id, (l) =>
                  isVectorTextLayer(l) ? { ...l, text } : l,
                )
              }
              onChangeFont={(fontFamily) => {
                void ensureToonFont(fontFamily);
                editor.update(selected.id, (l) =>
                  isVectorTextLayer(l) ? { ...l, style: { ...l.style, fontFamily } } : l,
                );
              }}
              onChangeFontSize={(fontSize) =>
                editor.update(selected.id, (l) =>
                  isVectorTextLayer(l)
                    ? { ...l, style: { ...l.style, fontSize } }
                    : l,
                )
              }
              onChangePosition={(pos) => {
                editor.update(selected.id, (l) => {
                  if (!isVectorTextLayer(l)) return l;
                  const W = tree.canvas.width;
                  const H = tree.canvas.height;
                  const w = l.box.width;
                  const h = l.box.height;
                  let x = l.box.x;
                  let y = l.box.y;
                  if (pos === "top_left") {
                    x = 60;
                    y = 70;
                  } else if (pos === "top_center") {
                    x = Math.round((W - w) / 2);
                    y = 70;
                  } else if (pos === "top_right") {
                    x = W - w - 60;
                    y = 70;
                  } else if (pos === "center") {
                    x = Math.round((W - w) / 2);
                    y = Math.round((H - h) / 2);
                  } else if (pos === "bottom") {
                    x = Math.round((W - w) / 2);
                    y = H - h - 70;
                  }
                  const tail = l.tail
                    ? {
                        x: x + Math.round(w / 2),
                        y: Math.min(H - 20, y + h + 110),
                      }
                    : undefined;
                  return {
                    ...l,
                    box: { ...l.box, x, y },
                    tail: tail ?? l.tail,
                  };
                });
              }}
              onToggleLock={() =>
                editor.update(selected.id, (l) => ({ ...l, locked: !l.locked }))
              }
              onDelete={() => setConfirmDelete(selected)}
            />
          )}

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

      <Modal
        open={cutToDelete !== null}
        onClose={() => setCutToDelete(null)}
        title={`${cutToDelete?.index}컷을 삭제할까요?`}
        description="이 컷과 작업한 레이어가 회차에서 제외됩니다. 컷 순서는 자동으로 재정렬돼요."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCutToDelete(null)}>
              그대로 두기
            </Button>
            <Button
              variant="danger"
              loading={isDeletingCut}
              onClick={handleConfirmDeleteCut}
            >
              컷 삭제
            </Button>
          </>
        }
      />

      <WebtoonComicViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={`${seriesTitle} - ${episodeTitle}`}
        cuts={cuts.map((c) => ({
          cutId: c.cutId,
          imageUrl: c.imageUrl ?? undefined,
          index: c.index,
        }))}
      />
    </div>
  );
}

function Toolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddPreset,
  saveLabel,
  saveError,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddPreset: (presetId: ElementPresetId) => void;
  saveLabel: string;
  saveError: boolean;
}) {
  return (
    <div className="flex h-13 items-center gap-2 border-b border-border/80 bg-surface-card/90 px-4 backdrop-blur-md">
      <div className="flex items-center gap-1">
        <ToolButton label="실행 취소 (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="size-4.5" />
        </ToolButton>
        <ToolButton label="다시 실행 (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="size-4.5" />
        </ToolButton>
      </div>

      <span className="mx-2 h-5 w-px bg-border/60" />

      {/* 레이어 추가는 이 툴바 한 곳에서만 한다. 우측 패널은 레이어 순서·속성 전용. */}
      <div role="group" aria-label="레이어 추가" className="flex items-center gap-1.5 overflow-x-auto py-1">
        {ADD_LAYER_ACTIONS.map((a) => (
          <ActionButton
            key={a.id}
            icon={a.icon}
            label={a.label}
            title={a.title}
            onClick={() => onAddPreset(a.id)}
          />
        ))}
      </div>

      <span className="ml-auto flex items-center gap-3">
        {/* 자동 저장은 3초 디바운스다(PRD 성능). 저장 버튼을 따로 두지 않는다. */}
        <span
          aria-live="polite"
          className={cn("text-caption font-medium", saveError ? "text-danger" : "text-ink-subtle")}
        >
          {saveLabel}
        </span>
        <Badge tone="ai">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="size-3 text-brand" />
            <span>AI 생성</span>
          </span>
        </Badge>
      </span>
    </div>
  );
}

const ADD_LAYER_ACTIONS: {
  id: ElementPresetId;
  label: string;
  title: string;
  icon: React.ReactNode;
}[] = [
  { id: "balloon_normal", label: "말풍선", title: "대사 말풍선", icon: <MessageSquare className="size-3.5 text-brand" /> },
  { id: "balloon_thought", label: "생각", title: "생각 / 속마음 말풍선", icon: <Cloud className="size-3.5 text-sky-500" /> },
  { id: "balloon_shout", label: "외침", title: "외침 / 샤우트 말풍선", icon: <Flame className="size-3.5 text-rose-500" /> },
  { id: "narration_top", label: "상단 나레이션", title: "컷 상단 나레이션 박스", icon: <Scroll className="size-3.5 text-amber-600" /> },
  { id: "narration_bottom", label: "하단 나레이션", title: "컷 하단 나레이션 박스", icon: <PanelBottom className="size-3.5 text-amber-600" /> },
  { id: "sfx", label: "효과음", title: "효과음 (SFX)", icon: <Zap className="size-3.5 text-yellow-500" /> },
  { id: "title_hook", label: "제목", title: "제목 · 후킹 문구", icon: <Heading className="size-3.5 text-brand" /> },
  { id: "text", label: "텍스트", title: "자유 텍스트", icon: <Type className="size-3.5 text-violet-500" /> },
];

function ActionButton({
  icon,
  label,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      title={title}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-surface-card px-2.5 text-xs font-semibold text-ink shadow-2xs transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand"
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </motion.button>
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
      className="grid size-control-sm cursor-pointer place-items-center rounded-lg text-label text-ink-muted transition-all hover:bg-surface-sunken hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
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
        className="cursor-pointer p-0.5 text-ink-muted hover:text-ink disabled:opacity-30"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="뒤로"
        disabled={!canDown}
        onClick={onDown}
        className="cursor-pointer p-0.5 text-ink-muted hover:text-ink disabled:opacity-30"
      >
        <ChevronDown className="size-3.5" />
      </button>
    </span>
  );
}

function CutStrip({
  cuts,
  openCutId,
  isPortrait = false,
  onOpen,
  onDeleteCut,
}: {
  cuts: EditorStripCut[];
  openCutId: string;
  isPortrait?: boolean;
  onOpen: (cutId: string) => void;
  onDeleteCut?: (cut: EditorStripCut) => void;
}) {
  return (
    <nav
      aria-label="컷"
      className="flex gap-2.5 overflow-x-auto lg:flex-col lg:overflow-x-visible lg:overflow-y-auto"
    >
      {cuts.map((cut) => {
        const open = cut.cutId === openCutId;
        const ready = Boolean(cut.imageUrl);
        return (
          <div key={cut.cutId} className="group relative mx-auto">
            <button
              type="button"
              disabled={!ready}
              aria-current={open ? "true" : undefined}
              onClick={() => onOpen(cut.cutId)}
              className={cn(
                "relative block shrink-0 overflow-hidden rounded-xl border transition-all",
                isPortrait ? "w-20 aspect-[4/5] lg:w-24" : "w-24 aspect-square lg:w-28",
                ready ? "cursor-pointer hover:border-brand/80 shadow-2xs" : "cursor-default bg-skeleton",
                open ? "border-2 border-brand ring-2 ring-brand/20 shadow-xs" : "border-border",
              )}
            >
              {ready ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cut.imageUrl!} alt={`${cut.index}컷`} className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-caption text-ink-subtle">
                  아직 없음
                </span>
              )}
              <span className="absolute top-1.5 left-1.5 rounded-sm bg-black/60 px-1 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                {cut.index}컷
              </span>
            </button>
            {cuts.length > 1 && onDeleteCut && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCut(cut);
                }}
                title={`${cut.index}컷 삭제`}
                aria-label={`${cut.index}컷 삭제`}
                className="absolute -top-1.5 -right-1.5 hidden size-5.5 cursor-pointer items-center justify-center rounded-full bg-danger text-white shadow-xs transition-transform hover:scale-110 group-hover:flex"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function getLayerKindInfo(layer: Layer): { label: string; icon: React.ReactNode } {
  if (layer.kind === "balloon") {
    if (layer.balloon === "thought") {
      return { label: "생각 말풍선", icon: <Cloud className="size-3.5 text-sky-500" /> };
    }
    if (layer.balloon === "shout") {
      return { label: "외침 말풍선", icon: <Flame className="size-3.5 text-rose-500" /> };
    }
    return { label: "말풍선", icon: <MessageSquare className="size-3.5 text-brand" /> };
  }
  if (layer.kind === "narration") {
    if (layer.name.includes("하단") || layer.box.y > 600) {
      return { label: "하단 나레이션", icon: <PanelBottom className="size-3.5 text-amber-600" /> };
    }
    return { label: "상단 나레이션", icon: <Scroll className="size-3.5 text-amber-600" /> };
  }
  if (layer.kind === "sfx") {
    return { label: "효과음", icon: <Zap className="size-3.5 text-yellow-500" /> };
  }
  if (layer.kind === "text") {
    if (layer.name.includes("제목") || layer.name.includes("후킹")) {
      return { label: "제목", icon: <Heading className="size-3.5 text-brand" /> };
    }
    return { label: "텍스트", icon: <Type className="size-3.5 text-violet-500" /> };
  }
  if (layer.kind === "background") {
    return { label: "배경 이미지", icon: <Sparkles className="size-3.5 text-brand" /> };
  }
  return { label: "캐릭터 이미지", icon: <Sparkles className="size-3.5 text-brand" /> };
}

function LayerInspector({
  layer,
  onChangeName,
  onChangeText,
  onChangeFontSize,
  onChangeFont,
  onChangePosition,
  onToggleLock,
  onDelete,
}: {
  layer: Layer;
  onChangeName: (name: string) => void;
  onChangeText: (text: string) => void;
  onChangeFont: (family: string) => void;
  onChangeFontSize: (size: number) => void;
  onChangePosition: (pos: "top_left" | "top_center" | "top_right" | "center" | "bottom") => void;
  onToggleLock: () => void;
  onDelete: () => void;
}) {
  const vector = isVectorTextLayer(layer) ? (layer as VectorTextLayer) : null;
  const kindInfo = getLayerKindInfo(layer);

  return (
    <Panel title={layer.name || "레이어 속성"}>
      <div className="flex flex-col gap-3">
        <Field
          label="레이어 이름"
          value={layer.name}
          onChange={onChangeName}
          placeholder="레이어 이름 입력"
          maxLength={30}
        />

        <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2 text-caption">
          <span className="font-medium text-ink-muted">종류</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
            {kindInfo.icon}
            {kindInfo.label}
          </span>
        </div>

        {vector ? (
          <>
            <Field
              label="글"
              multiline
              rows={2}
              value={vector.text}
              onChange={onChangeText}
              maxLength={120}
            />

            <div className="flex flex-col gap-2">
              <span className="text-label font-semibold text-ink">위치 정렬</span>
              <div className="grid grid-cols-5 gap-1">
                <button
                  type="button"
                  onClick={() => onChangePosition("top_left")}
                  className="h-control-sm cursor-pointer rounded-md bg-surface-sunken text-caption font-medium text-ink-muted hover:bg-border hover:text-ink"
                  title="상단 좌측"
                >
                  ↖ 좌상
                </button>
                <button
                  type="button"
                  onClick={() => onChangePosition("top_center")}
                  className="h-control-sm cursor-pointer rounded-md bg-surface-sunken text-caption font-medium text-ink-muted hover:bg-border hover:text-ink"
                  title="상단 중앙"
                >
                  ↑ 상단
                </button>
                <button
                  type="button"
                  onClick={() => onChangePosition("top_right")}
                  className="h-control-sm cursor-pointer rounded-md bg-surface-sunken text-caption font-medium text-ink-muted hover:bg-border hover:text-ink"
                  title="상단 우측"
                >
                  ↗ 우상
                </button>
                <button
                  type="button"
                  onClick={() => onChangePosition("center")}
                  className="h-control-sm cursor-pointer rounded-md bg-surface-sunken text-caption font-medium text-ink-muted hover:bg-border hover:text-ink"
                  title="가운데"
                >
                  · 중앙
                </button>
                <button
                  type="button"
                  onClick={() => onChangePosition("bottom")}
                  className="h-control-sm cursor-pointer rounded-md bg-surface-sunken text-caption font-medium text-ink-muted hover:bg-border hover:text-ink"
                  title="하단 중앙"
                >
                  ↓ 하단
                </button>
              </div>
              <p className="text-caption text-ink-subtle">
                캔버스에서 직접 드래그하여 자유롭게 이동할 수도 있어요.
              </p>
            </div>

            <label className="flex items-center gap-3 text-label">
              <span className="shrink-0 text-ink-muted">글꼴</span>
              <select
                value={vector.style.fontFamily}
                onChange={(e) => onChangeFont(e.target.value)}
                className="h-control-sm min-w-0 flex-1 rounded-md border border-border-control bg-surface-card px-2 text-label text-ink"
              >
                {(["손글씨", "둥근", "굵은", "고딕", "명조", "장식"] as const).map((tone) => (
                  <optgroup key={tone} label={tone}>
                    {TOON_FONTS.filter((f) => f.tone === tone).map((f) => (
                      <option key={f.family} value={f.family}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

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
          </>
        ) : (
          <dl className="flex flex-col gap-2 text-label">
            <Row label="크기">
              {Math.round(layer.box.width)} × {Math.round(layer.box.height)}
            </Row>
          </dl>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onToggleLock}>
            {layer.locked ? "잠금 풀기" : "잠그기"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={layer.locked}>
            지우기
          </Button>
        </div>
      </div>
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
