/**
 * 생성 요청·결과 계약 — 오너: 웅싯(A).
 *
 * 태일이 올린 초안이다. 실제 파이프라인에 맞게 웅싯이 고치는 것을 전제로 하고,
 * 태일은 이 타입을 화면(CutProgressGrid, 회차 타임라인)에서 읽기만 한다.
 * 바꿀 때는 PR 리뷰로 서로 확인한다.
 */

/** 컷 하나의 생성 상태. 화면은 이 네 가지만 그린다. */
export type CutStatus = "queued" | "running" | "done" | "failed";

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partially_failed"
  | "failed";

/** 에이전트 모드는 콘티 전체, 한 컷 모드는 컷 하나. */
export type GenerationMode = "agent" | "single_cut";

/** 한 컷 모드의 제한 수정 동작. */
export type CutEditIntent =
  | "regenerate"
  | "keep_composition_change_expression"
  | "replace_background"
  | "inpaint_mask";

export interface CutGenerationRequest {
  cutId: string;
  episodeId: string;
  seriesId: string;
  intent: CutEditIntent;
  prompt: string;
  /**
   * 캐릭터 시트는 모든 호출에 고정 레퍼런스로 들어간다.
   * 직전 컷 출력물은 여기에 넣지 않는다 — 회차가 갈수록 캐릭터가 흘러간다.
   */
  characterSheetRefs: string[];
  assetRefs: string[];
  /** 시리즈 생성 규칙(그림체, 말투, 컷 비율)을 직렬화한 값. */
  seriesRule: Record<string, unknown>;
  /** intent 가 inpaint_mask 일 때만. */
  maskUrl?: string;
}

export interface CutGenerationResult {
  cutId: string;
  imageUrl: string;
  /** 모든 생성물에 AI 생성 메타데이터를 기록한다. */
  metadata: {
    model: string;
    seed?: number;
    generatedAt: string;
    aiGenerated: true;
  };
}

/**
 * 이미지 생성 API 는 이 인터페이스 뒤로 숨긴다.
 * 1차 모델 선정(오픈 이슈 1)이 끝나기 전에도 화면을 만들 수 있고, 나중에 교체할 수 있다.
 */
export interface ImageGenerator {
  generateCut(req: CutGenerationRequest): Promise<CutGenerationResult>;
  /** 모델이 지원하지 않으면 false. 부분 재생성 UI 노출 여부를 여기서 판단한다. */
  supportsInpainting(): boolean;
}

export interface GenerationJob {
  id: string;
  userId: string;
  episodeId: string;
  mode: GenerationMode;
  status: JobStatus;
  cuts: Array<{
    cutId: string;
    index: number;
    status: CutStatus;
    progress?: number;
    /** 실패한 컷만 개별 재시도한다. 성공한 컷은 건드리지 않는다. */
    error?: string;
    /** 이 컷에 쓴 크레딧의 hold. 실패 시 이 id 로 환불한다. */
    holdId?: string;
  }>;
  createdAt: string;
  finishedAt?: string;
}
