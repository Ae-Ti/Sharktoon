"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  canRedo,
  canUndo,
  commit,
  initHistory,
  preview,
  redo,
  undo,
  type HistoryState,
} from "./history";
import type { CutLayerTree, Layer, LayerBox } from "../types/layer";

/** PRD 비기능 요구사항 — 자동 저장은 3초 디바운스. */
const AUTOSAVE_MS = 3000;

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UseEditorOptions {
  initial: CutLayerTree;
  /** 실제 저장. 붙기 전에는 생략하면 저장된 척만 한다. */
  save?: (tree: CutLayerTree) => Promise<void>;
}

/**
 * 편집기 상태 — 레이어 트리, 선택, 실행 취소, 자동 저장.
 *
 * 캔버스(konva)와 오른쪽 패널이 같은 상태를 보게 하려고 화면이 아니라 훅에 둔다.
 */
export function useEditor({ initial, save }: UseEditorOptions) {
  const [history, setHistory] = useState<HistoryState>(() => initHistory(initial));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const tree = history.present;

  /** 드래그가 시작될 때의 트리. 끝날 때 이력 한 칸으로 묶는다. */
  const dragBase = useRef<CutLayerTree | null>(null);

  /** 이벤트 핸들러가 최신 이력을 읽어야 한다. 렌더 중에 쓰지 않는다. */
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const mapLayer = useCallback(
    (id: string, patch: (layer: Layer) => Layer, next: CutLayerTree): CutLayerTree => ({
      ...next,
      layers: next.layers.map((l) => (l.id === id ? patch(l) : l)),
    }),
    [],
  );

  /** 조작 중 미리보기. 이력에 쌓이지 않는다. */
  /** 캔버스가 조작 시작을 알려준다. 여기서 잡은 상태가 이력의 "이전 칸"이 된다. */
  const beginDrag = useCallback(() => {
    dragBase.current ??= historyRef.current.present;
  }, []);

  const previewBox = useCallback(
    (id: string, box: Partial<LayerBox>) => {
      setHistory((h) =>
        preview(
          h,
          mapLayer(id, (l) => ({ ...l, box: { ...l.box, ...box } }), h.present),
        ),
      );
      setSaveState("dirty");
    },
    [mapLayer],
  );

  /** 조작 끝. 드래그 전 상태와 묶어서 이력 한 칸이 된다. */
  const commitDrag = useCallback(() => {
    const before = dragBase.current;
    dragBase.current = null;
    if (!before) return;
    setHistory((h) => commit(h, h.present, before));
  }, []);

  /** 한 번에 끝나는 변경(텍스트 수정, 숨김 토글, 순서 변경)은 바로 한 칸이다. */
  const update = useCallback(
    (id: string, patch: (layer: Layer) => Layer) => {
      setHistory((h) => commit(h, mapLayer(id, patch, h.present), h.present));
      setSaveState("dirty");
    },
    [mapLayer],
  );

  const reorder = useCallback((from: number, to: number) => {
    setHistory((h) => {
      if (to < 0 || to >= h.present.layers.length) return h;
      const layers = [...h.present.layers];
      const [moved] = layers.splice(from, 1);
      layers.splice(to, 0, moved);
      return commit(h, { ...h.present, layers }, h.present);
    });
    setSaveState("dirty");
  }, []);

  const remove = useCallback(
    (id: string) => {
      setHistory((h) =>
        commit(
          h,
          { ...h.present, layers: h.present.layers.filter((l) => l.id !== id) },
          h.present,
        ),
      );
      setSelectedId((cur) => (cur === id ? null : cur));
      setSaveState("dirty");
    },
    [],
  );

  const add = useCallback((layer: Layer) => {
    setHistory((h) =>
      commit(h, { ...h.present, layers: [...h.present.layers, layer] }, h.present),
    );
    setSelectedId(layer.id);
    setSaveState("dirty");
  }, []);

  const doUndo = useCallback(() => {
    setHistory(undo);
    setSaveState("dirty");
  }, []);

  const doRedo = useCallback(() => {
    setHistory(redo);
    setSaveState("dirty");
  }, []);

  // 자동 저장. 마지막 변경에서 3초가 지나면 보낸다. 저장 버튼은 두지 않는다.
  useEffect(() => {
    if (saveState !== "dirty") return;

    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        await save?.(tree);
        setSaveState("saved");
      } catch {
        // 실패해도 편집은 계속된다. 다음 변경에서 다시 시도한다.
        setSaveState("error");
      }
    }, AUTOSAVE_MS);

    return () => clearTimeout(timer);
  }, [saveState, tree, save]);

  // 실행 취소·다시 실행 단축키. 편집기에서 제일 많이 눌리는 키다.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // 텍스트를 고치는 중에는 그 입력의 실행 취소여야 한다.
      if (target?.matches("input, textarea, [contenteditable='true']")) return;

      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      }
      if (e.key === "Escape") setSelectedId(null);
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const layer = tree.layers.find((l) => l.id === selectedId);
        // 배경은 지우면 컷이 빈다. 잠긴 레이어는 키로도 안 지워진다.
        if (layer && !layer.locked) {
          e.preventDefault();
          remove(selectedId);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo, remove, selectedId, tree.layers]);

  return {
    tree,
    selectedId,
    selected: tree.layers.find((l) => l.id === selectedId) ?? null,
    setSelectedId,
    beginDrag,
    previewBox,
    commitDrag,
    update,
    reorder,
    remove,
    add,
    undo: doUndo,
    redo: doRedo,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    saveState,
  };
}
