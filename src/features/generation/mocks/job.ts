/**
 * 생성 잡 목 데이터 — PRD 3.1.
 *
 * 한창 돌아가는 중간 상태를 고른다. 전부 완료된 잡을 목으로 쓰면
 * 실패·재시도·부분 환불 같은 정작 어려운 화면을 안 그리게 된다.
 */

import type { GenerationJob } from "@/contracts/generation";
import { mockCutImageUrl } from "./cutImage";
import { MOCK_EPISODE_ID, MOCK_STORYBOARD } from "./storyboard";

const CAPTION = MOCK_STORYBOARD.cuts.map((c) => c.scene.slice(0, 18));

export const MOCK_JOB: GenerationJob = {
  id: "job_001",
  userId: "u_001",
  episodeId: MOCK_EPISODE_ID,
  mode: "agent",
  status: "running",
  createdAt: "2026-09-18T16:42:00+09:00",
  cuts: [
    {
      cutId: "cut_1",
      index: 1,
      status: "done",
      imageUrl: mockCutImageUrl(1, CAPTION[0]),
      holdId: "hold_1",
      attempt: 1,
      startedAt: "2026-09-18T16:42:02+09:00",
      finishedAt: "2026-09-18T16:42:31+09:00",
    },
    {
      cutId: "cut_2",
      index: 2,
      status: "done",
      imageUrl: mockCutImageUrl(2, CAPTION[1]),
      holdId: "hold_2",
      attempt: 1,
      startedAt: "2026-09-18T16:42:31+09:00",
      finishedAt: "2026-09-18T16:43:04+09:00",
    },
    {
      cutId: "cut_3",
      index: 3,
      status: "running",
      progress: 62,
      holdId: "hold_3",
      attempt: 1,
      startedAt: "2026-09-18T16:43:04+09:00",
    },
    {
      // 콘텐츠 필터에 걸린 경우. 사용자 탓이 아니게 읽히도록 문구를 짧게 둔다.
      cutId: "cut_4",
      index: 4,
      status: "failed",
      error: "안전 필터에 걸려 이미지를 못 만들었어요",
      holdId: "hold_4",
      attempt: 2,
      startedAt: "2026-09-18T16:43:10+09:00",
      finishedAt: "2026-09-18T16:43:22+09:00",
    },
    { cutId: "cut_5", index: 5, status: "queued", attempt: 1 },
    { cutId: "cut_6", index: 6, status: "queued", attempt: 1 },
  ],
};

/** 재시도 상한. 넘으면 자동으로 다시 걸지 않고 사용자가 누를 때만 간다. */
export const MAX_AUTO_ATTEMPTS = 2;

/**
 * 편집기가 보는 상태. 편집기는 생성이 끝난 뒤에 들어가는 화면이라
 * 진행 중인 `MOCK_JOB` 을 그대로 쓰면 컷 스트립이 거의 비어 보인다.
 */
export const MOCK_JOB_COMPLETED: GenerationJob = {
  ...MOCK_JOB,
  status: "succeeded",
  finishedAt: "2026-09-18T16:45:10+09:00",
  cuts: MOCK_JOB.cuts.map((cut) => ({
    ...cut,
    status: "done",
    progress: undefined,
    error: undefined,
    imageUrl: cut.imageUrl ?? mockCutImageUrl(cut.index, CAPTION[cut.index - 1]),
    finishedAt: cut.finishedAt ?? "2026-09-18T16:45:10+09:00",
  })),
};
