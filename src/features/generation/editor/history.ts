/**
 * 편집 이력 — 오너: 웅싯(A). PRD 3.2 "편집 내용은 자동 저장하고 실행 취소와 다시 실행을 제공한다".
 *
 * 레이어 트리 전체를 스냅샷으로 쌓는다. 컷 하나의 레이어는 많아야 수십 개이고
 * 전부 원시값이라 diff 를 뜨는 것보다 통째로 들고 있는 편이 단순하고 안전하다.
 *
 * **끄는 동작은 한 칸이 아니다.** 드래그 중에 스냅샷을 쌓으면 실행 취소를 60번
 * 눌러야 원위치가 되므로, 커밋은 조작이 끝났을 때만 부른다(`commit`).
 * 조작 중에는 `preview` 로 현재 값만 바꾼다.
 */

import type { CutLayerTree } from "../types/layer";

/** 이 이상은 버린다. 한 컷 편집에서 50번을 되돌릴 일은 없고 메모리만 먹는다. */
const LIMIT = 50;

export interface HistoryState {
  present: CutLayerTree;
  past: CutLayerTree[];
  future: CutLayerTree[];
}

export function initHistory(tree: CutLayerTree): HistoryState {
  return { present: tree, past: [], future: [] };
}

/** 조작 중 미리보기. 이력에 쌓지 않는다. */
export function preview(state: HistoryState, next: CutLayerTree): HistoryState {
  return { ...state, present: next };
}

/**
 * 한 칸 확정. `before` 는 조작이 시작되기 전 상태다 — 드래그 중 preview 로
 * present 가 이미 바뀌었으므로 여기서 past 에 넣을 값을 따로 받는다.
 */
export function commit(
  state: HistoryState,
  next: CutLayerTree,
  before: CutLayerTree = state.present,
): HistoryState {
  if (next === before) return state;
  return {
    present: next,
    past: [...state.past, before].slice(-LIMIT),
    // 되돌린 뒤 새로 고치면 앞으로 갈 곳은 사라진다.
    future: [],
  };
}

export function undo(state: HistoryState): HistoryState {
  const prev = state.past.at(-1);
  if (!prev) return state;
  return {
    present: prev,
    past: state.past.slice(0, -1),
    future: [state.present, ...state.future],
  };
}

export function redo(state: HistoryState): HistoryState {
  const next = state.future[0];
  if (!next) return state;
  return {
    present: next,
    past: [...state.past, state.present],
    future: state.future.slice(1),
  };
}

export const canUndo = (s: HistoryState) => s.past.length > 0;
export const canRedo = (s: HistoryState) => s.future.length > 0;
