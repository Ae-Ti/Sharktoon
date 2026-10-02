/**
 * 생성 영역 저장소 — 콘티, 생성 잡, 컷(이미지·레이어), 게시물 패키지.
 *
 * 태일의 `PlatformRepository` 와 같은 방식으로 목 구현과 Supabase 구현을 두고
 * `NEXT_PUBLIC_DATA_SOURCE` 로 고른다. 화면 코드는 어느 쪽인지 모른다.
 *
 * 메서드가 두 무리로 나뉜다.
 *   사용자 요청 안에서 부르는 것 — RLS 가 소유자를 확인한다.
 *   생성 워커가 부르는 것(`worker*`) — 요청 밖에서 서비스 롤로 돈다. 소유자를 인자로 받는다.
 */

import type { GenerationJob } from "@/contracts/generation";
import type { EpisodeStatus } from "@/lib/supabase/database.types";
import type { CutLayerTree } from "../types/layer";
import type { Storyboard } from "../types/storyboard";

export interface SavedStoryboard {
  storyboard: Storyboard;
  usedMock: boolean;
}

/** 생성된 컷 하나. imageUrl 은 보기용(서명 URL·data URI)이고 만료될 수 있다. */
export interface CutRecord {
  cutId: string;
  index: number;
  imageRef: string | null;
  imageUrl: string | null;
  /** 편집기에서 저장한 레이어. 없으면 콘티와 이미지에서 처음 만든다. */
  layerTree: CutLayerTree | null;
}

/** 4.1 게시물 패키지. */
export interface PostPackage {
  /** 본문 3안 — 짧게, 감성, 유머(PRD 4.1). */
  captions: { short: string; emotional: string; humor: string };
  /** 시리즈 고정 해시태그와 화별 동적 해시태그를 구분한다. 합쳐서 15~25개. */
  hashtags: { fixed: string[]; dynamic: string[] };
  firstComment: string;
  usedMock: boolean;
  updatedAt: string;
}

export interface GenerationStore {
  getStoryboard(episodeId: string): Promise<SavedStoryboard | null>;
  saveStoryboard(storyboard: Storyboard, usedMock: boolean): Promise<void>;

  /** 화면이 읽는 잡. 소유자가 아니면 null. */
  getJob(jobId: string): Promise<GenerationJob | null>;
  getLatestJob(episodeId: string): Promise<GenerationJob | null>;

  listCuts(episodeId: string): Promise<CutRecord[]>;
  saveLayerTree(episodeId: string, cutId: string, tree: CutLayerTree): Promise<void>;

  getPostPackage(episodeId: string): Promise<PostPackage | null>;
  savePostPackage(episodeId: string, pkg: Omit<PostPackage, "updatedAt">): Promise<void>;

  /** 사용자가 인스타에 올렸다고 표시한다. 첫 게시 완주율의 분자다. */
  markPublished(episodeId: string): Promise<void>;

  // --- 생성 워커 전용 (서비스 롤). 잡·컷 진행은 큐가 직접 쓴다(queue/).
  /** 컷 이미지를 저장하고 ref 와 보기용 URL 을 돌려준다. */
  workerSaveCutImage(input: {
    ownerId: string;
    episodeId: string;
    cutId: string;
    index: number;
    imageUrl: string;
    meta: Record<string, unknown>;
  }): Promise<{ imageRef: string; imageUrl: string }>;
  workerSetEpisodeStatus(episodeId: string, status: EpisodeStatus): Promise<void>;
}
