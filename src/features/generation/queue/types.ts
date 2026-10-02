/**
 * 생성 큐 — PRD 3.1 "생성 요청은 큐로 처리하고 실패한 컷만 개별 재시도한다".
 *
 * 오픈 이슈 11 결정(2026-10-03): Supabase Postgres 를 큐로 쓴다(`supabase.ts`, 마이그레이션 0007).
 * 목 모드와 검증 스크립트는 인메모리 큐(`memory.ts`)를 쓴다. 파이프라인은 이 인터페이스만 본다.
 */

import type { CutEditIntent, GenerationJob, GenerationJobCut } from "@/contracts/generation";

/** 잡을 등록할 때 같이 넘기는 생성 재료. */
export interface JobContext {
  /** 컷마다 이미지 지시문과 수정 동작. */
  cuts: Record<string, { prompt: string; intent: CutEditIntent }>;
  /**
   * 고정 레퍼런스. Supabase 큐는 에셋 id 만 저장하고 꺼낼 때 다시 서명한다(서명 URL 은 만료된다).
   * 인메모리 큐는 지금 받은 URL 을 그대로 쓴다.
   */
  characterAssetIds: string[];
  assetIds: string[];
  characterSheetRefs: string[];
  assetRefs: string[];
  seriesRule: Record<string, unknown>;
}

/** 컷 한 번을 만드는 데 필요한 것 전부. 큐가 꺼내서 작업자에게 넘긴다. */
export interface CutWork {
  job: Pick<GenerationJob, "id" | "userId" | "episodeId" | "seriesId">;
  cut: Pick<GenerationJobCut, "cutId" | "index" | "attempt">;
  intent: CutEditIntent;
  prompt: string;
  characterSheetRefs: string[];
  assetRefs: string[];
  seriesRule: Record<string, unknown>;
  /** 이전 작업자가 죽으면서 남긴 hold. 새로 잡기 전에 돌려준다. */
  staleHoldId?: string;
  /** hold 를 잡으면 알린다. 큐가 기록해 두었다가 작업자가 죽으면 위의 staleHoldId 로 쓴다. */
  onHold?: (holdId: string) => Promise<void>;
}

export interface CutResult {
  imageUrl: string;
  imageRef: string;
}

/** 실패하면 `refunded` 를 단 Error 를 던진다. */
export type CutRunner = (work: CutWork) => Promise<CutResult>;

export interface JobQueue {
  /** 잡과 컷들을 등록한다. */
  submit(job: GenerationJob, context: JobContext): Promise<void>;
  /**
   * 컷 하나를 다시 넣는다. 성공한 다른 컷은 건드리지 않는다.
   * `change` 가 있으면 한 컷 모드 — 수정 동작과 추가 요청을 바꿔서 넣는다.
   */
  requeue(
    jobId: string,
    cutId: string,
    change?: { intent: CutEditIntent; request?: string },
  ): Promise<void>;
  /** 화면이 보는 현재 상태. 소유자 확인은 부르는 쪽이 한다. */
  get(jobId: string): Promise<GenerationJob | null>;
  /** 이 사용자의 아직 안 끝난 잡 수. 사용자별 동시 생성 3화 제한에 쓴다. */
  countActive(userId: string): Promise<number>;
  /**
   * 쌓인 일을 처리한다. 주어진 시간 안에서 꺼낼 수 있는 만큼. 처리한 컷 수를 돌려준다.
   * 인메모리 큐는 등록하는 순간 스스로 돌므로 할 일이 없다.
   */
  drain(budgetMs: number): Promise<number>;
}

/** 실패한 컷의 지시문에 붙는 한 컷 모드 요청. 여러 번 고치면 마지막 요청만 남긴다. */
export function withRequest(prompt: string, request?: string): string {
  const base = prompt.split("\n요청: ")[0];
  return request ? `${base}\n요청: ${request}` : base;
}

/** 한 잡 안에서 모델에 동시에 던지는 컷 수. */
export const CUT_CONCURRENCY = 2;

/** 사용자별 동시 생성 상한(PRD 비기능 요구사항 "사용자별 동시 생성은 3화로 제한한다"). */
export const MAX_ACTIVE_JOBS_PER_USER = 3;

/** 실제 모델이 컷 하나에 쓰는 시간 추정. 진행률 막대를 이걸로 채운다. */
export const EXPECTED_CUT_MS = 15_000;

/**
 * 진행 중인 컷의 추정 진행률. 모델이 중간 진행률을 주지 않는다.
 * 80% 에서 멈춘다 — 안 끝났는데 100% 를 보여주면 멈춘 것처럼 보이는 것보다 나쁘다.
 */
export function estimateProgress(startedAt: string | undefined, now = Date.now()): number {
  if (!startedAt) return 0;
  const elapsed = Math.max(0, now - Date.parse(startedAt));
  return Math.min(80, Math.round((elapsed / EXPECTED_CUT_MS) * 80));
}
