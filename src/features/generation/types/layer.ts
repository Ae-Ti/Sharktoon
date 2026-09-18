/**
 * 컷 레이어 트리 — 오너: 웅싯(A). PRD 3.2.
 *
 * 공통 컴포넌트 `LayerRow` 의 props(`kindShort`, `vector`)를 여기서 파생시킨다.
 * 화면에서 문자열을 손으로 적으면 컷마다 약자가 갈리므로 `toLayerRowProps` 만 쓴다.
 */

export type LayerKind =
  | "background"
  | "character"
  | "balloon"
  | "text"
  | "narration"
  | "sfx";

/** LayerRow 의 24px 칩에 들어가는 2자 약자. 공통 컴포넌트 예시와 같은 표기다. */
export const LAYER_KIND_SHORT: Record<LayerKind, string> = {
  background: "배경",
  character: "캐릭",
  balloon: "말풍",
  text: "텍스",
  narration: "나레",
  sfx: "효과",
};

/**
 * 이미지에 굽지 않고 벡터로 남기는 종류.
 * PRD 3.2 "텍스트와 말풍선은 이미지와 분리된 벡터 레이어로 유지한다" 가 이 집합이다.
 * 배경·캐릭터는 생성 이미지라 벡터가 아니다.
 */
const VECTOR_KINDS: ReadonlySet<LayerKind> = new Set<LayerKind>([
  "balloon",
  "text",
  "narration",
  "sfx",
]);

export function isVectorLayer(kind: LayerKind): boolean {
  return VECTOR_KINDS.has(kind);
}

/** 말풍선 종류. PRD 3.2 는 12종 이상을 요구한다. */
export type BalloonKind =
  | "normal"
  | "thought"
  | "shout"
  | "whisper"
  | "narration_box"
  | "telepathy"
  | "broadcast"
  | "wobble"
  | "spike"
  | "cloud"
  | "chain"
  | "none";

export const BALLOON_LABEL: Record<BalloonKind, string> = {
  normal: "일반",
  thought: "생각",
  shout: "외침",
  whisper: "속삭임",
  narration_box: "나레이션 박스",
  telepathy: "텔레파시",
  broadcast: "방송",
  wobble: "떨림",
  spike: "뾰족",
  cloud: "구름",
  chain: "연결",
  none: "꼬리 없음",
};

/** 캔버스 좌표. 컷 이미지 원본 픽셀 기준이고 화면 배율과 무관하다. */
export interface LayerBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 도(degree). 기본 0. */
  rotation?: number;
}

interface LayerBase {
  id: string;
  name: string;
  kind: LayerKind;
  box: LayerBox;
  hidden?: boolean;
  /** 잠근 레이어는 캔버스에서 집히지 않는다. 배경을 실수로 끌지 않게 한다. */
  locked?: boolean;
  opacity?: number;
}

/** 생성 이미지 레이어. 부분 재생성의 대상이 되는 것은 이쪽뿐이다. */
export interface ImageLayer extends LayerBase {
  kind: "background" | "character";
  imageUrl: string;
  /** 이 레이어를 만든 생성 결과. 되돌리기·재생성 추적용. */
  sourceCutId?: string;
}

export interface TextStyle {
  /** 폰트 패밀리 이름. 작품 안 글꼴은 UI 폰트와 별개로 관리한다(디자인 가이드). */
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  color?: string;
  /** 효과음처럼 배경 위에 얹는 글자에 쓴다. */
  strokeColor?: string;
  strokeWidth?: number;
}

/** 말풍선·텍스트·나레이션·효과음. 전부 벡터로 남는다. */
export interface VectorTextLayer extends LayerBase {
  kind: "balloon" | "text" | "narration" | "sfx";
  text: string;
  style: TextStyle;
  /** kind 가 balloon 일 때의 모양. 그 외에는 none. */
  balloon: BalloonKind;
  /** 말풍선 꼬리가 가리키는 점. 컷 이미지 좌표계. */
  tail?: { x: number; y: number };
  /**
   * 나레이션 박스는 시리즈 스타일을 기본으로 쓰고 컷에서 덮어쓸 수 있다(PRD 3.2).
   * true 면 이 레이어가 시리즈 값을 덮어쓴 상태다.
   */
  overridesSeriesStyle?: boolean;
}

export type Layer = ImageLayer | VectorTextLayer;

export function isVectorTextLayer(layer: Layer): layer is VectorTextLayer {
  return isVectorLayer(layer.kind);
}

/** 컷 하나의 레이어 트리. 배열 뒤쪽이 위에 그려진다. */
export interface CutLayerTree {
  cutId: string;
  /** 컷 이미지 원본 크기. 캔버스 배율 계산의 기준이다. */
  canvas: { width: number; height: number };
  /** z 순서 오름차순. [0] 이 맨 아래(보통 배경)다. */
  layers: Layer[];
}

/** 공통 컴포넌트 LayerRow 에 그대로 넘기는 props. */
export function toLayerRowProps(layer: Layer) {
  return {
    name: layer.name,
    kindShort: LAYER_KIND_SHORT[layer.kind],
    vector: isVectorLayer(layer.kind),
    hidden: layer.hidden,
  };
}
