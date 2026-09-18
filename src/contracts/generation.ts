/**
 * 생성 요청·결과 계약 — 오너: 웅싯(A).
 *
 * 태일이 올린 초안을 실제 파이프라인에 맞게 고친 것이다.
 * 태일은 이 타입을 화면(CutProgressGrid, 회차 타임라인)에서 읽기만 한다.
 * 바꿀 때는 PR 리뷰로 서로 확인한다.
 *
 * 초안에서 바뀐 것(전부 추가이고 기존 필드는 그대로다):
 * - `GenerationJob.cuts[]` 에 `imageUrl`, `attempt`, `startedAt`, `finishedAt` 추가.
 *   진행률 화면이 완료된 컷 썸네일을 바로 보여주고, 재시도 횟수로 상한을 건다.
 * - `CREDIT_REASON_BY_INTENT` 추가. hold 금액이 intent 마다 다른데 초안에는 근거가 없었다.
 *   (태일 확인: 0.5크레딧은 마스크 인페인팅만. 표정·배경 변경은 1크레딧.)
 * - `summarizeJob()` 추가. 태일 타임라인과 내 진행률 화면이 같은 셈을 두 번 쓰지 않게 한다.
 */

import type { CreditSpendReason } from "./credit";

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

export const CUT_EDIT_INTENT_LABEL: Record<CutEditIntent, string> = {
  regenerate: "이 컷만 다시",
  keep_composition_change_expression: "구도 유지하고 표정만 변경",
  replace_background: "배경만 교체",
  inpaint_mask: "선택 영역만 다시",
};

/**
 * intent 마다 hold 할 금액의 근거.
 *
 * 0.5크레딧인 "부분 재생성"은 **마스크 인페인팅 하나뿐**이다(PRD 부록 D:
 * "컷 내 마스크 영역만 프롬프트로 다시 생성하는 인페인팅").
 *
 * 표정만 변경·배경만 교체는 PRD 3.1.2 의 한 컷 모드 제한 수정 동작이지
 * 부분 재생성이 아니다. 프롬프트를 좁힐 뿐 모델은 컷 한 장을 통째로 다시
 * 생성하므로 원가가 1컷 생성과 같다. 0.5크레딧을 받으면 마진이 뒤집힌다.
 *
 * 단가 자체는 오픈 이슈 4(크레딧 단가 마진 재산정)에서 결제 오픈 전에 다시 본다.
 */
export const CREDIT_REASON_BY_INTENT: Record<CutEditIntent, CreditSpendReason> = {
  regenerate: "cut_image",
  keep_composition_change_expression: "cut_image",
  replace_background: "cut_image",
  inpaint_mask: "partial_regenerate",
};

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

export interface GenerationJobCut {
  cutId: string;
  index: number;
  status: CutStatus;
  progress?: number;
  /** done 인 컷의 결과. 진행률 화면이 끝난 컷부터 썸네일로 보여준다. */
  imageUrl?: string;
  /** 실패한 컷만 개별 재시도한다. 성공한 컷은 건드리지 않는다. */
  error?: string;
  /** 이 컷에 쓴 크레딧의 hold. 실패 시 이 id 로 환불한다. */
  holdId?: string;
  /** 1부터. 자동 재시도 상한을 넘으면 사용자가 직접 누를 때만 다시 건다. */
  attempt: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface GenerationJob {
  id: string;
  userId: string;
  episodeId: string;
  mode: GenerationMode;
  status: JobStatus;
  cuts: GenerationJobCut[];
  createdAt: string;
  finishedAt?: string;
}

export interface JobSummary {
  total: number;
  done: number;
  failed: number;
  running: number;
  queued: number;
  /** 컷 단위 평균 진행률(%). running 컷의 부분 진행까지 센다. */
  percent: number;
}

/** 진행률 화면과 회차 타임라인이 같은 수를 보게 한다. 실패한 컷은 완료로 세지 않는다. */
export function summarizeJob(job: GenerationJob): JobSummary {
  const total = job.cuts.length;
  const count = (s: CutStatus) => job.cuts.filter((c) => c.status === s).length;
  const earned = job.cuts.reduce((sum, c) => {
    if (c.status === "done") return sum + 1;
    if (c.status === "running") return sum + (c.progress ?? 0) / 100;
    return sum;
  }, 0);

  return {
    total,
    done: count("done"),
    failed: count("failed"),
    running: count("running"),
    queued: count("queued"),
    percent: total === 0 ? 0 : Math.round((earned / total) * 100),
  };
}
