/**
 * 목 생성 저장소. 프로세스 메모리에만 산다. 새로고침이 아니라 서버 재시작에 초기화된다.
 * 목에는 Storage 가 없으므로 이미지 ref 가 곧 data URI 다.
 */

import type { GenerationJob } from "@/contracts/generation";
import { mockRepository } from "@/features/platform/data/mock";
import { processSingleton } from "@/lib/singleton";
import type { CutLayerTree } from "../types/layer";
import type { CutRecord, GenerationStore, PostPackage, SavedStoryboard } from "./types";

const S = processSingleton("generation-mock", () => {
  const storyboards = new Map<string, SavedStoryboard>();
  const jobs = new Map<string, GenerationJob>();
  const cuts = new Map<string, Map<string, CutRecord>>();
  const packages = new Map<string, PostPackage>();

  // 데모 및 게시 화면 검증을 위한 ep_001 시드 데이터
  const ep1Cuts = new Map<string, CutRecord>();
  for (let i = 1; i <= 4; i++) {
    ep1Cuts.set(`cut_ep1_${i}`, {
      cutId: `cut_ep1_${i}`,
      index: i,
      imageRef: `/benchmark/episodes/1_sunburst_cut_${i}.png`,
      imageUrl: `/benchmark/episodes/1_sunburst_cut_${i}.png`,
      layerTree: null,
    });
  }
  cuts.set("ep_001", ep1Cuts);

  storyboards.set("ep_001", {
    usedMock: true,
    storyboard: {
      id: "sb_001",
      episodeId: "ep_001",
      seriesId: "sr_villain",
      status: "generated",
      story: "열심히 준비한 기획안, 회의실에서 순간 도둑맞았습니다.",
      characters: [
        { key: "me", name: "나" },
        { key: "boss", name: "부장님" },
      ],
      hookOptions: [
        { id: "hk_1", text: "다들 퇴근 직전에 이런 적 있으시죠? 😭", rationale: "공감형 질문" },
        { id: "hk_2", text: "내 아이디어를 뺏겼을 때 대처법", rationale: "정보형 후킹" },
      ],
      selectedHookId: "hk_1",
      ctaOptions: [
        { id: "cta_1", kind: "question", text: "여러분이라면 어떻게 하셨을까요? 댓글로 알려주세요!", rationale: "댓글 참여 유도" },
      ],
      selectedCtaId: "cta_1",
      cuts: [
        {
          id: "cut_ep1_1",
          index: 1,
          scene: "회의실에서 아이디어 발표",
          characterIds: ["me"],
          emotion: "determined",
          camera: "medium",
          dialogue: [{ id: "l1", speakerId: "me", text: "이번 신규 아이디어는 이렇습니다!", balloon: "normal" }],
        },
        {
          id: "cut_ep1_2",
          index: 2,
          scene: "부장님의 가로채기",
          characterIds: ["boss"],
          emotion: "surprised",
          camera: "close_up",
          dialogue: [{ id: "l2", speakerId: "boss", text: "어, 그 아이디어 말이야~ 내가 생각한 건데.", balloon: "normal" }],
        },
        {
          id: "cut_ep1_3",
          index: 3,
          scene: "당황한 주인공의 표정",
          characterIds: ["me"],
          emotion: "embarrassed",
          camera: "close_up",
          dialogue: [{ id: "l3", speakerId: "me", text: "(네...? 지난주에 보고드렸는데...)", balloon: "thought" }],
        },
        {
          id: "cut_ep1_4",
          index: 4,
          scene: "체념하고 퇴근길 혼술",
          characterIds: ["me"],
          emotion: "sad",
          camera: "medium",
          dialogue: [{ id: "l4", speakerId: "me", text: "하... 인생 참 쓰다", balloon: "normal" }],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  return { storyboards, jobs, cuts, packages };
});

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
  async deleteCut(episodeId, cutId) {
    cutsOf(episodeId).delete(cutId);
    for (const job of S.jobs.values()) {
      if (job.episodeId === episodeId) {
        job.cuts = job.cuts.filter((c) => c.cutId !== cutId);
      }
    }
    await syncEpisodeThumb(episodeId);
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
    await syncEpisodeThumb(episodeId);
    return { imageRef: imageUrl, imageUrl };
  },
  async workerSetEpisodeStatus(episodeId, status) {
    await setEpisodeStatus(episodeId, status);
  },
};

/** 인메모리 큐가 상태를 바꿀 때 사본을 남긴다(목 모드 전용). */
export function saveMockJob(job: GenerationJob) {
  S.jobs.set(job.id, structuredClone(job));
}

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

/** 회차 썸네일은 맨 앞 컷 이미지다. 컷이 저장·삭제될 때마다 다시 맞춘다. */
async function syncEpisodeThumb(episodeId: string) {
  const first = [...cutsOf(episodeId).values()]
    .filter((c) => c.imageUrl)
    .sort((a, b) => a.index - b.index)[0];
  for (const s of await mockRepository.listSeries()) {
    const detail = await mockRepository.getSeries(s.id);
    const ep = detail?.episodes.find((e) => e.id === episodeId);
    if (!ep) continue;
    ep.thumbUrl = first?.imageUrl ?? null;
    return;
  }
}
