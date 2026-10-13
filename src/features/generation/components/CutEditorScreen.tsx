"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Badge, Button, ButtonLink, Field, LayerRow, Modal } from "@/components/ui";
import { WebtoonComicViewer } from "@/components/ui/WebtoonComicViewer";
import { cn } from "@/lib/cn";
import { CREDIT_COST } from "@/contracts/credit";
import { regenerateCutAction, saveLayerTreeAction } from "../actions";
import { DEFAULT_TOON_FONT, TOON_FONTS, ensureToonFont } from "../editor/fonts";
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
import {
  ElementPalette,
  buildLayerFromPreset,
  type ElementPresetId,
} from "../editor/ElementPalette";
import { exportMaskToDataUrl, type MaskLine } from "../editor/EditorCanvas";
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
  Layers,
  Sparkles,
  ChevronUp,
  ChevronDown,
  BookOpen,
  Paintbrush,
  Eraser,
  RotateCcw,
  Loader2,
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
  /** ImageGenerator.supportsInpainting(). 꺼져 있으면 부분 재생성 UI 를 아예 감춘다. */
  supportsInpainting?: boolean;
  seriesTitle: string;
  episodeTitle: string;
}

/** PRD 3.2 — 레이어 기반 컷 편집기. */
export function CutEditorScreen({
  episodeId,
  jobId,
  cuts,
  tree: initialTree,
  credits,
  supportsInpainting = false,
  seriesTitle,
  episodeTitle,
}: CutEditorScreenProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<Layer | null>(null);
  const [asideTab, setAsideTab] = useState<"elements" | "layers">("elements");
  const [viewerOpen, setViewerOpen] = useState(false);

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

  // 부분 수정 (인페인팅 마스크) 상태
  const [isMaskMode, setIsMaskMode] = useState(false);
  const [brushTool, setBrushTool] = useState<"brush" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState<number>(45);
  const [maskLines, setMaskLines] = useState<MaskLine[]>([]);
  const [inpaintPrompt, setInpaintPrompt] = useState("");
  const [isSubmittingInpaint, setIsSubmittingInpaint] = useState(false);
  const [inpaintError, setInpaintError] = useState<string | null>(null);

  const handleInpaintSubmit = useCallback(async () => {
    if (maskLines.length === 0) {
      setInpaintError("캔버스에서 고칠 영역을 먼저 칠해 주세요.");
      return;
    }
    setIsSubmittingInpaint(true);
    setInpaintError(null);

    try {
      const maskUrl = exportMaskToDataUrl(maskLines, canvasW, canvasH);
      const res = await regenerateCutAction({
        episodeId,
        jobId: jobId ?? undefined,
        cutId: tree.cutId,
        intent: "inpaint_mask",
        prompt: inpaintPrompt.trim() || undefined,
        maskUrl,
      });

      if (!res.ok) {
        setInpaintError(res.message);
        setIsSubmittingInpaint(false);
        return;
      }

      // 성공적으로 큐에 등록됨 -> 마스크 모드 닫기 및 폴링 시작
      setMaskLines([]);
      setIsMaskMode(false);

      if (jobId) {
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/jobs/${jobId}`);
            if (!pollRes.ok) return;
            const data = await pollRes.json();
            const thisCut = data.job?.cuts?.find((c: { cutId: string }) => c.cutId === tree.cutId);
            if (thisCut?.status === "done" && thisCut.imageUrl) {
              clearInterval(interval);
              setIsSubmittingInpaint(false);
              const bg = tree.layers.find((l) => l.kind === "background");
              if (bg) {
                editor.update(bg.id, (l) => ({ ...l, url: thisCut.imageUrl }));
              }
              router.refresh();
            } else if (thisCut?.status === "failed") {
              clearInterval(interval);
              setIsSubmittingInpaint(false);
              setInpaintError(thisCut.error ?? "부분 생성에 실패했어요");
            }
          } catch {
            // 네트워크 오류 시 무시하고 다음 틱 대기
          }
        }, 1500);

        setTimeout(() => {
          clearInterval(interval);
          setIsSubmittingInpaint(false);
          router.refresh();
        }, 60000);
      } else {
        setTimeout(() => {
          setIsSubmittingInpaint(false);
          router.refresh();
        }, 3000);
      }
    } catch (e) {
      setInpaintError(e instanceof Error ? e.message : "부분 재생성에 실패했어요");
      setIsSubmittingInpaint(false);
    }
  }, [canvasH, canvasW, editor, episodeId, inpaintPrompt, jobId, maskLines, router, tree.cutId, tree.layers]);

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
        />

        <section
          ref={canvasBox}
          aria-label="캔버스"
          className="relative grid min-h-[320px] place-items-center overflow-hidden rounded-2xl border border-border/80 bg-surface-sunken p-4 shadow-inner"
        >
          {isMaskMode && (
            <div className="pointer-events-none absolute top-4 z-10 flex items-center gap-2 rounded-full border border-accent/30 bg-surface-card/95 px-4 py-1.5 text-caption font-semibold text-accent shadow-md backdrop-blur-md">
              <Paintbrush className="size-3.5 animate-pulse" />
              <span>고치고 싶은 영역을 마우스나 터치로 칠해 주세요</span>
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
              isMaskMode={isMaskMode}
              brushTool={brushTool}
              brushSize={brushSize}
              maskLines={maskLines}
              onMaskLinesChange={setMaskLines}
            />
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {/* 사이드바 탭: 요소 라이브러리 vs 레이어 순서 */}
          <div className="flex rounded-xl bg-surface-sunken p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setAsideTab("elements")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-center text-label font-semibold transition-all",
                asideTab === "elements"
                  ? "bg-surface-card text-ink shadow-2xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              <MessageSquare className="size-3.5" />
              <span>말풍선 & 요소</span>
            </button>
            <button
              type="button"
              onClick={() => setAsideTab("layers")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-center text-label font-semibold transition-all",
                asideTab === "layers"
                  ? "bg-surface-card text-ink shadow-2xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              <Layers className="size-3.5" />
              <span>레이어 ({rows.length})</span>
            </button>
          </div>

          {asideTab === "elements" && (
            <Panel title="말풍선 & 텍스트 추가" caption="클릭하면 캔버스에 즉시 추가돼요.">
              <ElementPalette onSelectPreset={handleAddPreset} />
            </Panel>
          )}

          {asideTab === "layers" && (
            <Panel title="레이어 순서" caption="위에 있는 것이 앞에 그려져요.">
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
          )}

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
                  isVectorTextLayer(l)
                    ? {
                        ...l,
                        balloon,
                        // 꼬리가 없던 레이어를 말풍선으로 바꾸면 아래쪽에 꼬리를 하나 달아 준다.
                        tail: l.tail ?? {
                          x: l.box.x + l.box.width / 2,
                          y: l.box.y + l.box.height + 100,
                        },
                      }
                    : l,
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

          <Panel
            title="부분만 다시 만들기"
            caption="고치고 싶은 영역만 칠해서 수정해요. 크레딧이 절반(0.5)만 들어요."
          >
            {supportsInpainting ? (
              <div className="flex flex-col gap-3">
                {/* 1. 브러시 모드 켜기/끄기 토글 */}
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-sunken p-2.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full transition-colors",
                        isMaskMode ? "bg-accent animate-pulse" : "bg-ink-muted/40",
                      )}
                    />
                    <span className="text-label font-semibold text-ink">
                      {isMaskMode ? "영역 칠하기 모드" : "브러시 꺼짐"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={isMaskMode ? "primary" : "secondary"}
                    onClick={() => setIsMaskMode((v) => !v)}
                  >
                    <Paintbrush className="mr-1.5 size-3.5" />
                    {isMaskMode ? "칠하기 완료" : "영역 칠하기"}
                  </Button>
                </div>

                {/* 2. 브러시 설정 패널 (모드 ON일 때 확장) */}
                {isMaskMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex flex-col gap-2.5 rounded-xl border border-accent/25 bg-accent/5 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-caption font-semibold text-accent">도구</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setBrushTool("brush")}
                          className={cn(
                            "flex items-center gap-1 rounded-md px-2.5 py-1 text-caption font-medium transition-colors cursor-pointer",
                            brushTool === "brush"
                              ? "bg-accent text-white shadow-2xs"
                              : "bg-surface-card text-ink-muted hover:text-ink",
                          )}
                        >
                          <Paintbrush className="size-3" />
                          브러시
                        </button>
                        <button
                          type="button"
                          onClick={() => setBrushTool("eraser")}
                          className={cn(
                            "flex items-center gap-1 rounded-md px-2.5 py-1 text-caption font-medium transition-colors cursor-pointer",
                            brushTool === "eraser"
                              ? "bg-accent text-white shadow-2xs"
                              : "bg-surface-card text-ink-muted hover:text-ink",
                          )}
                        >
                          <Eraser className="size-3" />
                          지우개
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-caption text-ink-muted">굵기</span>
                      <div className="flex items-center gap-1">
                        {([
                          { label: "소 (20px)", size: 20 },
                          { label: "중 (45px)", size: 45 },
                          { label: "대 (80px)", size: 80 },
                        ] as const).map((b) => (
                          <button
                            key={b.size}
                            type="button"
                            onClick={() => setBrushSize(b.size)}
                            className={cn(
                              "rounded-md px-2 py-0.5 text-caption transition-colors cursor-pointer",
                              brushSize === b.size
                                ? "bg-surface-card font-bold text-ink shadow-2xs border border-border"
                                : "text-ink-muted hover:text-ink",
                            )}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-accent/15">
                      <span className="text-caption text-ink-muted">
                        {maskLines.length > 0
                          ? `칠한 획: ${maskLines.length}개`
                          : "캔버스를 드래그해 칠하세요"}
                      </span>
                      {maskLines.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setMaskLines([])}
                          className="flex items-center gap-1 text-caption text-ink-muted hover:text-danger cursor-pointer"
                        >
                          <RotateCcw className="size-3" />
                          칠한 영역 비우기
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 3. 인페인팅 지시문 입력 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-label font-medium text-ink">
                    어떻게 고칠까요?
                  </label>
                  <input
                    type="text"
                    value={inpaintPrompt}
                    onChange={(e) => setInpaintPrompt(e.target.value)}
                    placeholder="예: 살짝 미소 짓는 표정으로, 고양이 눈동자를 크게..."
                    className="w-full rounded-xl border border-border/80 bg-surface-card px-3 py-2 text-body-sm text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  {inpaintError && (
                    <p className="text-caption text-danger">{inpaintError}</p>
                  )}
                </div>

                {/* 4. 실행 버튼 */}
                <Button
                  variant="primary"
                  cost={CREDIT_COST.partialRegenerate}
                  block
                  disabled={isSubmittingInpaint || maskLines.length === 0}
                  loading={isSubmittingInpaint}
                  onClick={handleInpaintSubmit}
                >
                  {isSubmittingInpaint ? "부분 생성 중..." : "칠한 곳만 다시 만들기 (0.5 크레딧)"}
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

      {/* 직관적인 요소 추가 버튼 그룹 (Canva/젠툰 스타일 스튜디오 툴바) */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        <ActionButton icon={<MessageSquare className="size-3.5 text-brand" />} label="말풍선" onClick={() => onAddPreset("balloon_normal")} />
        <ActionButton icon={<Scroll className="size-3.5 text-amber-600" />} label="나레이션" onClick={() => onAddPreset("narration_top")} />
        <ActionButton icon={<Cloud className="size-3.5 text-sky-500" />} label="생각" onClick={() => onAddPreset("balloon_thought")} />
        <ActionButton icon={<Flame className="size-3.5 text-rose-500" />} label="외침" onClick={() => onAddPreset("balloon_shout")} />
        <ActionButton icon={<Zap className="size-3.5 text-yellow-500" />} label="효과음" onClick={() => onAddPreset("sfx")} />
        <ActionButton icon={<Type className="size-3.5 text-violet-500" />} label="텍스트" onClick={() => onAddPreset("text")} />
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

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
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
}: {
  cuts: EditorStripCut[];
  openCutId: string;
  isPortrait?: boolean;
  onOpen: (cutId: string) => void;
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
          <button
            key={cut.cutId}
            type="button"
            disabled={!ready}
            aria-current={open ? "true" : undefined}
            onClick={() => onOpen(cut.cutId)}
            className={cn(
              "relative shrink-0 overflow-hidden rounded-xl border transition-all mx-auto",
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
  onChangeFont,
  onChangePosition,
  onToggleLock,
  onDelete,
}: {
  layer: Layer;
  onChangeText: (text: string) => void;
  onChangeBalloon: (balloon: BalloonKind) => void;
  onChangeFont: (family: string) => void;
  onChangeFontSize: (size: number) => void;
  onChangePosition: (pos: "top_left" | "top_center" | "top_right" | "center" | "bottom") => void;
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
