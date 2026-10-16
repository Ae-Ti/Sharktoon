"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, ButtonLink, Field, LayerRow, Modal } from "@/components/ui";
import { WebtoonComicViewer } from "@/components/ui/WebtoonComicViewer";
import { cn } from "@/lib/cn";
import { deleteCutAction, saveLayerTreeAction } from "../actions";
import { TOON_FONTS, ensureToonFont } from "../editor/fonts";
import { BALLOON_SHAPE } from "../editor/shapes";
import {
  isVectorTextLayer,
  toLayerRowProps,
  type CutLayerTree,
  type ImageLayer,
  type Layer,
  type VectorTextLayer,
} from "../types/layer";
import { useEditor } from "../editor/useEditor";
import { useMeasuredSize } from "../editor/useMeasuredSize";
import {
  buildLayerFromPreset,
  type ElementPresetId,
} from "../editor/ElementPalette";
import {
  Undo2,
  Redo2,
  Sparkles,
  Zap,
  Camera,
  Smile,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  BookOpen,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Plus,
  Paintbrush,
  Check,
} from "lucide-react";
import { EpisodeHeader } from "./EpisodeHeader";
import { AddLayerModal } from "./AddLayerModal";
import { useJobPolling } from "./useJobPolling";
import { regenerateCutAction, retryFailedCutsAction } from "../actions";
import type { GenerationJob, CutEditIntent } from "@/contracts/generation";
import type { Storyboard, StoryboardCut } from "../types/storyboard";

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
  status?: "queued" | "running" | "done" | "failed";
  tree?: CutLayerTree | null;
}

export interface CutEditorScreenProps {
  episodeId: string;
  jobId?: string | null;
  initialJob?: GenerationJob | null;
  storyboard?: Storyboard | null;
  cuts: EditorStripCut[];
  tree: CutLayerTree;
  credits: number;
  seriesTitle: string;
  episodeTitle: string;
}

/** PRD 3.2 — 레이어 기반 컷 편집기 & 라이브 제작 스튜디오. */
export function CutEditorScreen({
  episodeId,
  jobId,
  initialJob,
  storyboard,
  cuts,
  tree: initialTree,
  credits,
  seriesTitle,
  episodeTitle,
}: CutEditorScreenProps) {
  const router = useRouter();
  const { job, balance, live, refresh } = useJobPolling(initialJob, credits);

  const [confirmDelete, setConfirmDelete] = useState<Layer | null>(null);
  const [cutToDelete, setCutToDelete] = useState<EditorStripCut | null>(null);
  const [isDeletingCut, setIsDeletingCut] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [regenNotice, setRegenNotice] = useState<string | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [renderingViewer, setRenderingViewer] = useState(false);
  const [viewerCuts, setViewerCuts] = useState<{ cutId: string; imageUrl?: string; index: number }[]>([]);
  const [mobileTab, setMobileTab] = useState<"layers" | "inspector">("layers");
  const [addLayerModalOpen, setAddLayerModalOpen] = useState(false);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

  // 실시간 잡 상태가 반영된 컷 목록
  const liveCuts = useMemo(() => {
    return cuts.map((c) => {
      const jc = job?.cuts.find((x) => x.cutId === c.cutId);
      return {
        ...c,
        imageUrl: jc?.imageUrl ?? c.imageUrl,
        status: (jc?.status as EditorStripCut["status"]) ?? c.status ?? (c.imageUrl ? "done" : "queued"),
      };
    });
  }, [cuts, job?.cuts]);

  // 현재 열려 있는 컷 정보
  const currentCut = liveCuts.find((c) => c.cutId === initialTree.cutId);
  const currentImageUrl = currentCut?.imageUrl;
  const currentSbCut = storyboard?.cuts.find((c) => c.id === initialTree.cutId);

  // 진행 통계
  const doneCount = liveCuts.filter((c) => Boolean(c.imageUrl) || c.status === "done").length;
  const totalCount = liveCuts.length;
  const failedCuts = job?.cuts.filter((c) => c.status === "failed") ?? [];
  const allDone = doneCount === totalCount && totalCount > 0;

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

  // 컷 이미지 재생성 실행
  async function handleRegenerateCut(
    intent: CutEditIntent,
    prompt?: string,
    targetTier?: "standard" | "pro",
  ) {
    setIsRegenerating(true);
    setRegenNotice(null);
    const res = await regenerateCutAction({
      episodeId,
      jobId: jobId ?? undefined,
      cutId: initialTree.cutId,
      intent,
      tier: targetTier,
      prompt: prompt?.trim() || undefined,
    });
    setIsRegenerating(false);
    if (res.ok) {
      void refresh(jobId ?? undefined);
      setRegenNotice("재생성을 시작했습니다. 잠시 후 이미지가 교체됩니다.");
    } else {
      setRegenNotice(res.message);
    }
  }

  // 실패 컷 일괄 재시도
  async function handleRetryFailed() {
    if (!job?.id) return;
    setIsRetrying(true);
    const res = await retryFailedCutsAction({ episodeId, jobId: job.id });
    setIsRetrying(false);
    if (res.ok) {
      void refresh(job.id);
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

  // 배경 이미지가 새로 도착했을 때 캔버스 레이어에 실시간 주입
  useEffect(() => {
    if (!currentImageUrl) return;
    const bgLayer = editor.tree.layers.find((l) => l.kind === "background");
    if (bgLayer && (bgLayer as ImageLayer).imageUrl !== currentImageUrl) {
      editor.update(bgLayer.id, (l) => ({ ...l, imageUrl: currentImageUrl }));
    }
  }, [currentImageUrl, editor]);

  // 위에 그려지는 레이어가 목록 맨 위로 오도록 뒤집는다. z 순서와 목록 순서가 반대다.
  const rows = [...tree.layers].reverse();

  const handleAddPreset = useCallback(
    (presetId: ElementPresetId, customText?: string) => {
      const layer = buildLayerFromPreset(tree, presetId, customText);
      editor.add(layer);
      editor.setSelectedId(layer.id);
    },
    [editor, tree],
  );

  const handleOpenViewer = useCallback(async () => {
    setRenderingViewer(true);
    try {
      const { renderCutDataUrl } = await import("../editor/exportCarousel");
      const exportRatio = canvasH > canvasW ? "4:5" : "1:1";
      const rendered = await Promise.all(
        liveCuts.map(async (c) => {
          const cutTree = c.cutId === initialTree.cutId ? editor.tree : c.tree;
          if (cutTree) {
            try {
              const url = await renderCutDataUrl(cutTree, { ratio: exportRatio, watermark: false });
              return { cutId: c.cutId, imageUrl: url, index: c.index };
            } catch (err) {
              console.error(`Failed to render cut ${c.index}:`, err);
            }
          }
          return { cutId: c.cutId, imageUrl: c.imageUrl ?? undefined, index: c.index };
        }),
      );
      setViewerCuts(rendered);
      setViewerOpen(true);
    } catch (e) {
      console.error(e);
      setViewerCuts(
        liveCuts.map((c) => ({
          cutId: c.cutId,
          imageUrl: c.imageUrl ?? undefined,
          index: c.index,
        })),
      );
      setViewerOpen(true);
    } finally {
      setRenderingViewer(false);
    }
  }, [canvasH, canvasW, liveCuts, editor.tree, initialTree.cutId]);

  // 저장 상태 표시: 저장됨은 3초 후 자동 페이드아웃하여 숨긴다.
  const [showSaveLabel, setShowSaveLabel] = useState(false);

  useEffect(() => {
    if (editor.saveState === "dirty" || editor.saveState === "saving" || editor.saveState === "error") {
      setShowSaveLabel(true);
    } else if (editor.saveState === "saved") {
      setShowSaveLabel(true);
      const timer = setTimeout(() => {
        setShowSaveLabel(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowSaveLabel(false);
    }
  }, [editor.saveState]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-page">
      <EpisodeHeader
        episodeId={episodeId}
        seriesTitle={seriesTitle}
        episodeTitle={episodeTitle}
        current="editor"
        credits={balance}
        hideActionOnMobile={true}
        action={
          <div className="flex items-center gap-2">
            {live && (
              <div className="flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-subtle px-2.5 py-1 text-xs font-semibold text-brand animate-pulse">
                <Loader2 className="size-3 animate-spin" />
                <span>AI 생성 중 ({doneCount}/{totalCount})</span>
              </div>
            )}
            {!live && failedCuts.length > 0 && (
              <Button
                size="sm"
                variant="danger"
                loading={isRetrying}
                onClick={handleRetryFailed}
                title="실패한 컷을 다시 생성합니다"
              >
                <RefreshCw className="mr-1 size-3" />
                실패 재시도 ({failedCuts.length})
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              loading={renderingViewer}
              onClick={handleOpenViewer}
              className="hidden md:inline-flex"
            >
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              웹툰 뷰어
            </Button>
            <ButtonLink
              href={`/episodes/${episodeId}/publish`}
              size="sm"
              className="hidden md:inline-flex"
            >
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
        saveLabel={SAVE_LABEL[editor.saveState]}
        saveError={editor.saveState === "error"}
        showSaveLabel={showSaveLabel}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[132px_minmax(0,1fr)_340px]">
        <CutStrip
          cuts={liveCuts}
          openCutId={initialTree.cutId}
          isPortrait={canvasH > canvasW}
          onOpen={(cutId) => router.push(`/episodes/${episodeId}/editor?cut=${cutId}${jobId ? `&job=${jobId}` : ""}`)}
          onDeleteCut={(c) => setCutToDelete(c)}
        />

        <div className="flex flex-col gap-2 min-h-0">
          <section
            ref={canvasBox}
            aria-label="캔버스"
            className="relative flex-1 grid min-h-[320px] place-items-center overflow-hidden rounded-2xl border border-border/80 bg-surface-sunken p-4 shadow-inner"
          >
            {/* 이미지가 아직 생성 중일 때 캔버스 중앙 안내 오버레이 */}
            {!currentImageUrl && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface-sunken/80 backdrop-blur-xs p-6 text-center">
                <Sparkles className="size-8 text-brand animate-pulse" />
                <div className="flex flex-col gap-1">
                  <p className="text-body font-bold text-ink">이 컷의 AI 이미지를 생성하고 있어요</p>
                  <p className="text-caption text-ink-muted">
                    완료되면 이미지가 바로 나타납니다. 대사와 말풍선 배치는 지금 미리 수정할 수 있어요!
                  </p>
                </div>
              </div>
            )}

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
                editingId={editingLayerId}
                onEditingIdChange={setEditingLayerId}
                onUpdateText={(id, text) =>
                  editor.update(id, (l) => (isVectorTextLayer(l) ? { ...l, text } : l))
                }
              />
            )}
          </section>

          {/* 캔버스 하단 컨트롤 바 (캔버스를 덮지 않고 외부에 배치) */}
          <div className="flex items-center justify-between px-1 shrink-0">
            {/* 뒤로 가기 / 앞으로 가기 (Undo / Redo) */}
            <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-surface-card p-1 shadow-2xs">
              <button
                type="button"
                onClick={editor.undo}
                disabled={!editor.canUndo}
                aria-label="실행 취소 (뒤로 가기)"
                title="뒤로 가기 (Ctrl+Z)"
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-all cursor-pointer",
                  editor.canUndo
                    ? "text-ink hover:bg-surface-sunken active:scale-95"
                    : "text-ink-subtle opacity-30 cursor-not-allowed",
                )}
              >
                <Undo2 className="size-4" />
              </button>
              <div className="h-4 w-px bg-border/60" />
              <button
                type="button"
                onClick={editor.redo}
                disabled={!editor.canRedo}
                aria-label="다시 실행 (앞으로 가기)"
                title="앞으로 가기 (Ctrl+Shift+Z)"
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-all cursor-pointer",
                  editor.canRedo
                    ? "text-ink hover:bg-surface-sunken active:scale-95"
                    : "text-ink-subtle opacity-30 cursor-not-allowed",
                )}
              >
                <Redo2 className="size-4" />
              </button>
            </div>

            {/* 저장 상태 표시 (3초 지나면 자동으로 숨김) */}
            <div
              className={cn(
                "flex items-center transition-opacity duration-300",
                showSaveLabel ? "opacity-100" : "opacity-0 pointer-events-none",
              )}
            >
              <span
                aria-live="polite"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface-card px-2.5 py-1 text-[11px] font-semibold shadow-2xs",
                  editor.saveState === "error"
                    ? "text-danger border-danger/40"
                    : editor.saveState === "saved"
                      ? "text-success border-success/30"
                      : "text-ink-subtle",
                )}
              >
                {editor.saveState === "saved" && <Check className="size-3 text-success stroke-[2.5]" />}
                {SAVE_LABEL[editor.saveState]}
              </span>
            </div>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {/* 모바일 전용 레이어 목록 vs 속성 편집 탭 (lg 미만) */}
          <div className="flex rounded-xl border border-border/80 bg-surface-sunken p-1 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTab("layers")}
              className={cn(
                "flex-1 rounded-lg py-2 text-center text-xs font-semibold transition-all cursor-pointer",
                mobileTab === "layers"
                  ? "bg-surface-card text-brand font-bold shadow-2xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              레이어 목록 ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("inspector")}
              className={cn(
                "flex-1 rounded-lg py-2 text-center text-xs font-semibold transition-all cursor-pointer",
                mobileTab === "inspector"
                  ? "bg-surface-card text-brand font-bold shadow-2xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              레이어 편집 {selected ? `(${selected.name})` : ""}
            </button>
          </div>

          <div className={cn("flex flex-col gap-3", mobileTab === "layers" ? "block" : "hidden lg:block")}>
            <Panel
              title={`레이어 (${rows.length})`}
              caption="위 순서대로 캔버스에 겹쳐져 그려져요."
              action={
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setAddLayerModalOpen(true)}
                  className="gap-1.5 px-3 text-xs font-bold shadow-2xs shrink-0"
                >
                  <Plus className="size-3.5 stroke-[2.5]" />
                  <span>레이어 추가</span>
                </Button>
              }
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
                          onRename={(newName) => {
                            editor.update(layer.id, (l) => ({ ...l, name: newName }));
                          }}
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
          </div>

          <div className={cn("flex flex-col gap-3", mobileTab === "inspector" ? "block" : "hidden lg:block")}>
            {selected ? (
              <LayerInspector
                layer={selected}
                storyboardCut={currentSbCut}
                tier={job?.tier ?? "pro"}
                isRegenerating={isRegenerating}
                regenNotice={regenNotice}
                onRegenerate={handleRegenerateCut}
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
                onChangeBold={(bold) =>
                  editor.update(selected.id, (l) =>
                    isVectorTextLayer(l) ? { ...l, style: { ...l.style, bold } } : l,
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
                onChangeBorderColor={(borderColor) =>
                  editor.update(selected.id, (l) =>
                    isVectorTextLayer(l) ? { ...l, borderColor } : l,
                  )
                }
                onChangeBorderWidth={(borderWidth) =>
                  editor.update(selected.id, (l) =>
                    isVectorTextLayer(l) ? { ...l, borderWidth } : l,
                  )
                }
                onChangeTailCurved={(tailCurved) =>
                  editor.update(selected.id, (l) =>
                    isVectorTextLayer(l) ? { ...l, tailCurved } : l,
                  )
                }
                onChangeTailCurvature={(tailCurvature) =>
                  editor.update(selected.id, (l) =>
                    isVectorTextLayer(l) ? { ...l, tailCurvature } : l,
                  )
                }
                onToggleTail={(enabled) =>
                  editor.update(selected.id, (l) => {
                    if (!isVectorTextLayer(l)) return l;
                    if (enabled) {
                      const tail = l.tail ?? {
                        x: Math.round(l.box.x + l.box.width / 2),
                        y: Math.min(tree.canvas.height - 30, l.box.y + l.box.height + 90),
                      };
                      return { ...l, tail };
                    } else {
                      return { ...l, tail: undefined };
                    }
                  })
                }
                onToggleLock={() =>
                  editor.update(selected.id, (l) => ({ ...l, locked: !l.locked }))
                }
                onDelete={() => setConfirmDelete(selected)}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-caption text-ink-muted lg:hidden">
                수정할 말풍선이나 텍스트 레이어를 먼저 선택해 주세요.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 모바일 하단 플로팅 액션 바 (웹툰 뷰어 & 게시물로 내보내기) */}
      <div
        className="sticky bottom-0 z-20 border-t border-border/80 bg-surface-card/95 px-4 shadow-2xl backdrop-blur-md md:hidden"
        style={{
          paddingTop: "14px",
          paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center gap-2.5">
          {!live && failedCuts.length > 0 && (
            <Button
              size="md"
              variant="danger"
              loading={isRetrying}
              onClick={handleRetryFailed}
              title="실패한 컷을 다시 생성합니다"
              className="justify-center font-semibold text-caption shrink-0"
            >
              <RefreshCw className="mr-1 size-3.5" />
              재시도 ({failedCuts.length})
            </Button>
          )}
          <Button
            size="md"
            variant="secondary"
            loading={renderingViewer}
            onClick={handleOpenViewer}
            className="flex-1 justify-center font-semibold text-caption"
          >
            <BookOpen className="mr-1.5 size-4" />
            웹툰 뷰어
          </Button>
          <ButtonLink
            href={`/episodes/${episodeId}/publish`}
            size="md"
            variant="primary"
            className="flex-1 justify-center font-bold text-caption shadow-xs"
          >
            게시물로 내보내기 ↗
          </ButtonLink>
        </div>
      </div>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        sheetOnMobile={false}
        title="이 레이어를 지울까요?"
        description={
          confirmDelete
            ? `"${confirmDelete.name}" 을 지웁니다. 실행 취소로 되돌릴 수 있어요.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(null)}
              className="flex-1 sm:flex-initial"
            >
              그대로 두기
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) editor.remove(confirmDelete.id);
                setConfirmDelete(null);
              }}
              className="flex-1 sm:flex-initial"
            >
              지우기
            </Button>
          </>
        }
      />

      <Modal
        open={cutToDelete !== null}
        onClose={() => setCutToDelete(null)}
        sheetOnMobile={false}
        title={`${cutToDelete?.index}컷을 삭제할까요?`}
        description="이 컷과 작업한 레이어가 회차에서 제외됩니다. 컷 순서는 자동으로 재정렬돼요."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setCutToDelete(null)}
              className="flex-1 sm:flex-initial"
            >
              그대로 두기
            </Button>
            <Button
              variant="danger"
              loading={isDeletingCut}
              onClick={handleConfirmDeleteCut}
              className="flex-1 sm:flex-initial"
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
        cuts={
          viewerCuts.length > 0
            ? viewerCuts
            : cuts.map((c) => ({
                cutId: c.cutId,
                imageUrl: c.imageUrl ?? undefined,
                index: c.index,
              }))
        }
      />

      {/* 모달로 옵션을 선택하여 새 레이어 생성 */}
      <AddLayerModal
        open={addLayerModalOpen}
        onClose={() => setAddLayerModalOpen(false)}
        onAdd={handleAddPreset}
      />
    </div>
  );
}

function Toolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveLabel,
  saveError,
  showSaveLabel,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveLabel: string;
  saveError: boolean;
  showSaveLabel: boolean;
}) {
  return (
    <div className="hidden md:flex h-13 items-center justify-between border-b border-border/80 bg-surface-card/90 px-4 backdrop-blur-md">
      <div className="flex items-center gap-1.5 shrink-0">
        <ToolButton label="실행 취소 (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="size-4.5" />
        </ToolButton>
        <ToolButton label="다시 실행 (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="size-4.5" />
        </ToolButton>
        <span className="mx-2 h-5 w-px bg-border/60 shrink-0" />
        <span className="hidden sm:inline text-xs text-ink-muted">
          캔버스에서 말풍선·텍스트를 클릭하여 직접 이동하고 편집할 수 있어요
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span
          aria-live="polite"
          className={cn(
            "text-caption font-medium transition-opacity duration-300",
            showSaveLabel ? "opacity-100" : "opacity-0",
            saveError ? "text-danger" : "text-ink-subtle",
          )}
        >
          {saveLabel}
        </span>
      </div>
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
      className="flex gap-2.5 overflow-x-auto p-1.5 lg:flex-col lg:overflow-y-auto lg:p-2"
    >
      {cuts.map((cut) => {
        const open = cut.cutId === openCutId;
        const ready = Boolean(cut.imageUrl);
        const isRunning = !ready && (cut.status === "running" || cut.status === "queued");
        const isFailed = !ready && cut.status === "failed";

        return (
          <div key={cut.cutId} className="group relative mx-auto shrink-0 pt-1.5 pr-1.5">
            <button
              type="button"
              aria-current={open ? "true" : undefined}
              onClick={() => onOpen(cut.cutId)}
              className={cn(
                "relative block shrink-0 overflow-hidden rounded-xl border transition-all cursor-pointer",
                isPortrait ? "w-20 aspect-[4/5] lg:w-24" : "w-24 aspect-square lg:w-28",
                open ? "border-2 border-brand ring-2 ring-brand/20 shadow-xs" : "border-border",
                isRunning && "bg-surface-sunken animate-pulse border-brand/40",
                isFailed && "bg-danger-subtle border-danger/40",
                ready && "hover:border-brand/80 shadow-2xs",
              )}
            >
              {ready ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cut.imageUrl!} alt={`${cut.index}컷`} className="size-full object-cover" />
              ) : isFailed ? (
                <div className="grid size-full place-items-center p-1 text-center bg-danger-subtle">
                  <AlertTriangle className="size-4 text-danger mb-0.5" />
                  <span className="text-[10px] font-semibold text-danger">생성 실패</span>
                </div>
              ) : (
                <div className="grid size-full place-items-center p-1 text-center bg-surface-sunken">
                  <Loader2 className="size-4 text-brand animate-spin mb-0.5" />
                  <span className="text-[10px] font-semibold text-brand">생성 중</span>
                </div>
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
                className={cn(
                  "absolute top-0 right-0 z-10 size-5.5 cursor-pointer items-center justify-center rounded-full bg-danger text-white border-2 border-black shadow-sm transition-transform hover:scale-110 active:scale-95",
                  open ? "flex" : "hidden group-hover:flex",
                )}
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

const BORDER_PRESET_COLORS = [
  { label: "잉크 블랙", value: "#121820" },
  { label: "차콜 그레이", value: "#374151" },
  { label: "브랜드 청록", value: "#0f766e" },
  { label: "딥 블루", value: "#1e3a8a" },
  { label: "비비드 레드", value: "#dc2626" },
  { label: "코랄 오렌지", value: "#ea580c" },
  { label: "바이올렛 퍼플", value: "#7c3aed" },
  { label: "화이트", value: "#ffffff" },
];

function LayerInspector({
  layer,
  storyboardCut,
  tier = "pro",
  isRegenerating = false,
  regenNotice,
  onRegenerate,
  onChangeText,
  onChangeFontSize,
  onChangeFont,
  onChangeBold,
  onChangePosition,
  onChangeBorderColor,
  onChangeBorderWidth,
  onChangeTailCurved,
  onChangeTailCurvature,
  onToggleTail,
  onToggleLock,
  onDelete,
}: {
  layer: Layer;
  storyboardCut?: StoryboardCut | null;
  tier?: "standard" | "pro";
  isRegenerating?: boolean;
  regenNotice?: string | null;
  onRegenerate?: (intent: CutEditIntent, prompt?: string, tier?: "standard" | "pro") => void;
  onChangeText: (text: string) => void;
  onChangeFont: (family: string) => void;
  onChangeFontSize: (size: number) => void;
  onChangeBold: (bold: boolean) => void;
  onChangePosition: (pos: "top_left" | "top_center" | "top_right" | "center" | "bottom") => void;
  onChangeBorderColor: (color: string) => void;
  onChangeBorderWidth: (width: number) => void;
  onChangeTailCurved: (curved: boolean) => void;
  onChangeTailCurvature: (curvature: number) => void;
  onToggleTail: (enabled: boolean) => void;
  onToggleLock: () => void;
  onDelete: () => void;
}) {
  const vector = isVectorTextLayer(layer) ? (layer as VectorTextLayer) : null;
  const [regenIntent, setRegenIntent] = useState<CutEditIntent>("regenerate");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedTier, setSelectedTier] = useState<"standard" | "pro">(tier);

  useEffect(() => {
    if (tier) setSelectedTier(tier);
  }, [tier]);

  return (
    <Panel title={layer.name || "레이어 편집"}>
      <div className="flex flex-col gap-3">

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

            <div className="flex items-center gap-3 text-label">
              <span className="shrink-0 text-ink-muted">굵기</span>
              <div className="grid flex-1 grid-cols-2 gap-1.5">
                {([false, true] as const).map((bold) => (
                  <button
                    key={String(bold)}
                    type="button"
                    onClick={() => onChangeBold(bold)}
                    className={cn(
                      "rounded-lg py-1.5 px-2 text-xs transition-all cursor-pointer",
                      !!vector.style.bold === bold
                        ? "bg-brand text-on-brand shadow-2xs font-bold"
                        : "bg-surface-card text-ink-muted hover:text-ink border border-border/60 font-semibold",
                    )}
                  >
                    {bold ? "굵게" : "보통"}
                  </button>
                ))}
              </div>
            </div>

            {/* 말풍선 및 나레이션 박스 테두리 스타일 (색상 & 굵기) */}
            {(vector.kind === "balloon" || vector.kind === "narration") && (
              <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface-sunken/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-label font-bold text-ink flex items-center gap-1.5">
                    <Paintbrush className="size-3.5 text-brand" />
                    테두리 스타일
                  </span>
                  <span className="text-caption font-semibold tabular-nums text-brand">
                    {vector.borderWidth ?? (BALLOON_SHAPE[vector.balloon]?.stroke ?? 3)}px
                  </span>
                </div>

                {/* 테두리 색상 선택 */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-caption font-medium text-ink-muted">테두리 색상</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {BORDER_PRESET_COLORS.map((c) => {
                      const isSelected =
                        (vector.borderColor ?? "#121820").toLowerCase() === c.value.toLowerCase();
                      return (
                        <button
                          key={c.value}
                          type="button"
                          title={c.label}
                          onClick={() => onChangeBorderColor?.(c.value)}
                          className={cn(
                            "size-6 rounded-full border transition-all cursor-pointer relative flex items-center justify-center shadow-2xs",
                            isSelected
                              ? "ring-2 ring-brand ring-offset-2 scale-110 border-brand"
                              : "border-black/20 hover:scale-105",
                          )}
                          style={{ backgroundColor: c.value }}
                        >
                          {isSelected && (
                            <Check
                              className={cn(
                                "size-3 stroke-[3]",
                                c.value === "#ffffff" ? "text-ink" : "text-white",
                              )}
                            />
                          )}
                        </button>
                      );
                    })}

                    {/* 커스텀 색상 선택기 */}
                    <label
                      title="직접 색상 선택"
                      className="relative size-6 rounded-full border border-dashed border-border-control cursor-pointer flex items-center justify-center bg-surface-card hover:border-brand shadow-2xs transition-all overflow-hidden"
                    >
                      <span className="text-[10px] font-bold text-ink-muted">+</span>
                      <input
                        type="color"
                        value={vector.borderColor ?? "#121820"}
                        onChange={(e) => onChangeBorderColor?.(e.target.value)}
                        className="absolute inset-0 size-full opacity-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* 테두리 굵기 슬라이더 & 프리셋 */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-medium text-ink-muted">테두리 굵기</span>
                    <span className="text-caption font-semibold text-ink tabular-nums">
                      {vector.borderWidth ?? (BALLOON_SHAPE[vector.balloon]?.stroke ?? 3)}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={0.5}
                    value={vector.borderWidth ?? (BALLOON_SHAPE[vector.balloon]?.stroke ?? 3)}
                    onChange={(e) => onChangeBorderWidth?.(Number(e.target.value))}
                    className="h-control-sm min-w-0 flex-1 accent-brand"
                  />
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
                    {[
                      { label: "얇게", w: 1.5 },
                      { label: "보통", w: 3 },
                      { label: "굵게", w: 5 },
                      { label: "강조", w: 8 },
                    ].map((p) => {
                      const currentW = vector.borderWidth ?? (BALLOON_SHAPE[vector.balloon]?.stroke ?? 3);
                      return (
                        <button
                          key={p.w}
                          type="button"
                          onClick={() => onChangeBorderWidth?.(p.w)}
                          className={cn(
                            "rounded-md py-1 text-[11px] font-semibold transition-all cursor-pointer text-center",
                            currentW === p.w
                              ? "bg-brand text-on-brand shadow-2xs font-bold"
                              : "bg-surface-card text-ink-muted hover:text-ink border border-border/60",
                          )}
                        >
                          {p.label} ({p.w}px)
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 말풍선 꼬리 옵션 (직선 / 곡선화 / 곡률) */}
            {vector.kind === "balloon" && Boolean(BALLOON_SHAPE[vector.balloon]?.tail) && (
              <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface-sunken/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-label font-bold text-ink flex items-center gap-1.5">
                    말풍선 꼬리
                  </span>
                  {onToggleTail && (
                    <button
                      type="button"
                      onClick={() => onToggleTail(!vector.tail)}
                      className="text-[11px] font-semibold text-brand hover:underline cursor-pointer"
                    >
                      {vector.tail ? "꼬리 숨기기" : "+ 꼬리 달기"}
                    </button>
                  )}
                </div>

                {vector.tail ? (
                  <>
                    {/* 직선 꼬리 vs 곡선 꼬리 토글 */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onChangeTailCurved?.(false)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-semibold transition-all cursor-pointer",
                          !vector.tailCurved
                            ? "bg-brand text-on-brand shadow-2xs font-bold"
                            : "bg-surface-card text-ink-muted hover:text-ink border border-border/60",
                        )}
                      >
                        <span>─</span> 직선 꼬리
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeTailCurved?.(true)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-semibold transition-all cursor-pointer",
                          vector.tailCurved
                            ? "bg-brand text-on-brand shadow-2xs font-bold"
                            : "bg-surface-card text-ink-muted hover:text-ink border border-border/60",
                        )}
                      >
                        <span>~</span> 곡선 꼬리
                      </button>
                    </div>

                    {/* 곡선 꼬리 옵션 활성화 시 세부 조절 */}
                    {vector.tailCurved && (
                      <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
                        <div className="flex items-center justify-between">
                          <span className="text-caption font-medium text-ink-muted">곡선 휘는 정도</span>
                          <span className="text-caption font-semibold text-brand tabular-nums">
                            {(vector.tailCurvature ?? 25) < 0
                              ? `좌측 ${Math.abs(vector.tailCurvature ?? 25)}%`
                              : (vector.tailCurvature ?? 25) > 0
                                ? `우측 ${vector.tailCurvature ?? 25}%`
                                : "직선 (0%)"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => onChangeTailCurvature?.(-25)}
                            className={cn(
                              "rounded-md py-1 px-2 text-[11px] font-semibold transition-all cursor-pointer text-center",
                              (vector.tailCurvature ?? 25) < 0
                                ? "bg-brand/15 text-brand font-bold border border-brand/30"
                                : "bg-surface-card text-ink-muted hover:text-ink border border-border/60",
                            )}
                          >
                            ⤹ 좌측으로 휘기 (-25)
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeTailCurvature?.(25)}
                            className={cn(
                              "rounded-md py-1 px-2 text-[11px] font-semibold transition-all cursor-pointer text-center",
                              (vector.tailCurvature ?? 25) > 0
                                ? "bg-brand/15 text-brand font-bold border border-brand/30"
                                : "bg-surface-card text-ink-muted hover:text-ink border border-border/60",
                            )}
                          >
                            ⤸ 우측으로 휘기 (+25)
                          </button>
                        </div>

                        <input
                          type="range"
                          min={-60}
                          max={60}
                          step={5}
                          value={vector.tailCurvature ?? 25}
                          onChange={(e) => onChangeTailCurvature?.(Number(e.target.value))}
                          className="h-control-sm min-w-0 flex-1 accent-brand"
                        />

                        <p className="text-[11px] text-ink-subtle leading-tight">
                          💡 캔버스에서 꼬리 끝 흰색 원 핸들을 드래그해 방향을 잡고, 곡률로 자연스럽게 휘게 만들 수 있어요.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-caption text-ink-subtle">
                    현재 꼬리가 없어요. 상단의 &apos;+ 꼬리 달기&apos;를 눌러 말풍선 꼬리를 추가할 수 있어요.
                  </p>
                )}
              </div>
            )}
          </>
        ) : layer.kind === "background" ? (
          <div className="flex flex-col gap-3 pt-1">
            <dl className="flex flex-col gap-1 text-label rounded-lg bg-surface-sunken p-2.5">
              <Row label="캔버스 크기">
                {Math.round(layer.box.width)} × {Math.round(layer.box.height)}
              </Row>
              {storyboardCut && (
                <div className="pt-2 border-t border-border/60 flex flex-col gap-1 text-caption">
                  <span className="font-semibold text-ink">콘티 연출 묘사</span>
                  <p className="text-ink-muted line-clamp-2 leading-relaxed">
                    {storyboardCut.scene}
                  </p>
                  {storyboardCut.emotion && (
                    <span className="text-ink-subtle text-[11px]">
                      감정: {storyboardCut.emotion} · 구도: {storyboardCut.camera || "기본"}
                    </span>
                  )}
                </div>
              )}
            </dl>

            {/* 이미지 실시간 재생성 옵션 카드 */}
            {onRegenerate && (
              <div className="flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand-subtle/30 p-3 shadow-2xs">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="text-label font-bold text-ink flex items-center gap-1.5">
                    <RefreshCw className={cn("size-3.5 text-brand", isRegenerating && "animate-spin")} />
                    이 컷 이미지 다시 생성
                  </span>

                  {/* 일반 / Pro 플랫 토글 */}
                  <div className="inline-flex rounded-lg bg-surface-card p-0.5 border border-border/80 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setSelectedTier("standard")}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-0.5 text-caption font-semibold transition-all cursor-pointer",
                        selectedTier === "standard"
                          ? "bg-brand text-on-brand shadow-2xs font-bold"
                          : "text-ink-muted hover:text-ink",
                      )}
                    >
                      <Zap className="size-3" />
                      일반 (1C)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTier("pro")}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-0.5 text-caption font-semibold transition-all cursor-pointer",
                        selectedTier === "pro"
                          ? "bg-brand text-on-brand shadow-2xs font-bold"
                          : "text-ink-muted hover:text-ink",
                      )}
                    >
                      <Sparkles className="size-3" />
                      Pro (2C)
                    </button>
                  </div>
                </div>

                {/* 인텐트 선택 */}
                <div className="grid grid-cols-3 gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => setRegenIntent("regenerate")}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-md py-1 px-1.5 text-xs font-semibold transition-all cursor-pointer text-center",
                      regenIntent === "regenerate"
                        ? "bg-brand text-on-brand shadow-2xs font-bold"
                        : "bg-surface-card text-ink-muted hover:text-ink border border-border/60",
                    )}
                  >
                    <Camera className="size-3 shrink-0" />
                    새 구도
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegenIntent("keep_composition_change_expression")}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-md py-1 px-1.5 text-xs font-semibold transition-all cursor-pointer text-center",
                      regenIntent === "keep_composition_change_expression"
                        ? "bg-brand text-on-brand shadow-2xs font-bold"
                        : "bg-surface-card text-ink-muted hover:text-ink border border-border/60",
                    )}
                  >
                    <Smile className="size-3 shrink-0" />
                    표정 변경
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegenIntent("replace_background")}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-md py-1 px-1.5 text-xs font-semibold transition-all cursor-pointer text-center",
                      regenIntent === "replace_background"
                        ? "bg-brand text-on-brand shadow-2xs font-bold"
                        : "bg-surface-card text-ink-muted hover:text-ink border border-border/60",
                    )}
                  >
                    <ImageIcon className="size-3 shrink-0" />
                    배경 변경
                  </button>
                </div>

                {/* 프롬프트 보강 (선택사항) */}
                <div className="flex flex-col gap-1 pt-0.5">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="연출 보강 (예: 더 환하게 웃는 표정)"
                    className="h-8 rounded-lg border border-border bg-surface-card px-2.5 text-xs text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
                  />
                </div>

                {regenNotice && (
                  <p className="text-[11px] text-brand font-medium">
                    {regenNotice}
                  </p>
                )}

                <Button
                  size="sm"
                  block
                  loading={isRegenerating}
                  onClick={() => onRegenerate(regenIntent, customPrompt, selectedTier)}
                  className="mt-0.5 font-bold flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={cn("size-3.5", isRegenerating && "animate-spin")} />
                  {isRegenerating
                    ? "이미지 생성 중..."
                    : `이 컷 다시 만들기 (${selectedTier === "pro" ? "2" : "1"}크레딧)`}
                </Button>
              </div>
            )}
          </div>
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
  action,
  children,
}: {
  title: string;
  caption?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="truncate text-label font-semibold text-ink">{title}</h2>
          {caption && <p className="text-caption text-ink-muted">{caption}</p>}
        </div>
        {action}
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
