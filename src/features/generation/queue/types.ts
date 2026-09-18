/**
 * 생성 큐 — 오너: 웅싯(A). PRD 3.1 "생성 요청은 큐로 처리하고 실패한 컷만 개별 재시도한다".
 *
 * 구현 방식은 오픈 이슈 11(Vercel Workflows vs Supabase pgmq)에서 정한다.
 * 그 전에도 파이프라인과 화면을 완성할 수 있도록 인터페이스를 먼저 고정한다.
 * `ImageGenerator` 와 같은 이유, 같은 방식이다.
 */

import type { GenerationJob } from "@/contracts/generation";

export interface EnqueueInput {
  jobId: string;
  cutId: string;
  index: number;
}

export interface JobQueue {
  /** 잡을 등록하고 컷들을 큐에 넣는다. 반환 즉시 돌기 시작한다. */
  submit(job: GenerationJob): Promise<void>;
  /** 실패한 컷 하나를 다시 큐에 넣는다. 성공한 컷은 건드리지 않는다. */
  requeue(jobId: string, cutId: string): Promise<void>;
  /** 화면이 폴링하는 현재 상태. Realtime 이 붙으면 이 값을 푸시로 바꾼다. */
  get(jobId: string): Promise<GenerationJob | null>;
}

/**
 * 동시 생성 상한. PRD 비기능 요구사항의 "사용자별 동시 생성은 3화로 제한한다"와
 * 별개로, 한 잡 안에서 모델에 동시에 던지는 컷 수다.
 */
export const CUT_CONCURRENCY = 2;
