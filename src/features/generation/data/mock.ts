/**
 * 목 생성 저장소. 프로세스 메모리에만 산다. 새로고침이 아니라 서버 재시작에 초기화된다.
 * 목에는 Storage 가 없으므로 이미지 ref 가 곧 data URI 다.
 */

import type { GenerationJob } from "@/contracts/generation";
import { mockRepository } from "@/features/platform/data/mock";
import { processSingleton } from "@/lib/singleton";
import type { CutLayerTree } from "../types/layer";
import type { CutRecord, GenerationStore, PostPackage, SavedStoryboard } from "./types";

const S = processSingleton("generation-mock", () => ({
  storyboards: new Map<string, SavedStoryboard>(),
  jobs: new Map<string, GenerationJob>(),
  cuts: new Map<string, Map<string, CutRecord>>(),
  packages: new Map<string, PostPackage>(),
}));

function cutsOf(episodeId: string) {
  let m = S.cuts.get(episodeId);
  if (!m) S.cuts.set(episodeId, (m = new Map()));
  return m;
}

export const mockGenerationStore: GenerationStore = {
  async getStoryboard(episodeId) {
    return structuredClone(S.storyboards.get(episodeId) ?? null);
  },
  async saveStoryboard(storyboard, usedMock) {
    S.storyboards.set(storyboard.episodeId, structuredClone({ storyboard, usedMock }));
  },

  async getJob(jobId) {
    return structuredClone(S.jobs.get(jobId) ?? null);
  },
  async getLatestJob(episodeId) {
    const jobs = [...S.jobs.values()].filter((j) => j.episodeId === episodeId);
    jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return structuredClone(jobs[0] ?? null);
  },

  async listCuts(episodeId) {
    return [...cutsOf(episodeId).values()]
      .sort((a, b) => a.index - b.index)
      .map((c) => structuredClone(c));
  },
  async saveLayerTree(episodeId, cutId, tree: CutLayerTree) {
    const cut = cutsOf(episodeId).get(cutId);
    if (!cut) throw new Error("아직 만들어지지 않은 컷이에요");
    cut.layerTree = structuredClone(tree);
  },

  async getPostPackage(episodeId) {
    return structuredClone(S.packages.get(episodeId) ?? null);
  },
  async savePostPackage(episodeId, pkg) {
    S.packages.set(episodeId, { ...structuredClone(pkg), updatedAt: new Date().toISOString() });
  },

  async markPublished(episodeId) {
    await setEpisodeStatus(episodeId, "published");
  },

  async workerSaveJob(job) {
    S.jobs.set(job.id, structuredClone(job));
  },
  async workerSaveCutImage({ episodeId, cutId, index, imageUrl }) {
    const cuts = cutsOf(episodeId);
    const prev = cuts.get(cutId);
    cuts.set(cutId, {
      cutId,
      index,
      imageRef: imageUrl,
      imageUrl,
      layerTree: prev?.layerTree ?? null,
    });
    return { imageRef: imageUrl, imageUrl };
  },
  async workerSetEpisodeStatus(episodeId, status) {
    await setEpisodeStatus(episodeId, status);
  },
};

/** 회차 상태는 플랫폼 목 저장소가 들고 있다. 같은 객체를 고친다. */
async function setEpisodeStatus(episodeId: string, status: GenerationJob["status"] | string) {
  for (const s of await mockRepository.listSeries()) {
    const detail = await mockRepository.getSeries(s.id);
    const ep = detail?.episodes.find((e) => e.id === episodeId);
    if (!ep) continue;
    ep.status = status as typeof ep.status;
    if (status === "published") ep.publishedAt = new Date().toISOString();
    return;
  }
}
