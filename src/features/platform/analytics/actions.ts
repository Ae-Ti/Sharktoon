"use server";

import { revalidatePath } from "next/cache";
import { usingMockData } from "@/features/platform/data";
import { INITIAL_MOCK_SNS_DATA } from "./mockData";
import type { SnsAnalyticsData, MediaKitSummary } from "./types";

/**
 * SNS 성과·미디어킷 — 지금은 목 모드 데모 전용이다.
 *
 * 아이디만 받아 "연동됨"으로 표시하고 미리 넣어 둔 예시 수치를 보여준다. 인증이 없으므로
 * 실 저장소(배포)에서는 쓰면 안 된다: 남의 아이디로 연동한 척할 수 있고, 이 값은 서버 메모리
 * 한 곳에 있어 모든 사용자가 같은 상태를 본다. 그래서 실 저장소에서는 미연동·빈 데이터만 돌려주고
 * 쓰기는 막는다(화면은 "출시 예정"). 실제 연동은 Instagram Login(src/features/platform/instagram).
 */
let currentSnsData: SnsAnalyticsData = { ...INITIAL_MOCK_SNS_DATA };

const COMING_SOON = "인스타그램 성과 연동은 출시 예정이에요.";

/** 실 저장소에서 보여줄 값. 예시 수치를 실제처럼 보여주지 않는다. */
function emptySnsData(): SnsAnalyticsData {
  return {
    ...INITIAL_MOCK_SNS_DATA,
    account: { ...INITIAL_MOCK_SNS_DATA.account, connected: false, username: "", followersCount: 0, mediaCount: 0 },
    topEpisodes: [],
  };
}

export async function getSnsAnalyticsAction(): Promise<{ ok: true; data: SnsAnalyticsData } | { ok: false; message: string }> {
  try {
    return { ok: true, data: usingMockData() ? currentSnsData : emptySnsData() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "SNS 성과 데이터를 불러오지 못했습니다." };
  }
}

export async function connectInstagramAction(username: string): Promise<{ ok: true; data: SnsAnalyticsData } | { ok: false; message: string }> {
  try {
    if (!usingMockData()) return { ok: false, message: COMING_SOON };
    const cleanUser = username.trim().replace(/^@/, "") || "sharktoon_daily";
    currentSnsData = {
      ...currentSnsData,
      account: {
        ...currentSnsData.account,
        username: cleanUser,
        connected: true,
        lastSyncedAt: new Date().toISOString(),
      },
    };
    revalidatePath("/settings");
    return { ok: true, data: currentSnsData };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "계정을 연동하지 못했습니다." };
  }
}

export async function disconnectInstagramAction(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (!usingMockData()) return { ok: false, message: COMING_SOON };
    currentSnsData = {
      ...currentSnsData,
      account: {
        ...currentSnsData.account,
        connected: false,
      },
    };
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "연동을 해제하지 못했습니다." };
  }
}

export async function refreshSnsAnalyticsAction(): Promise<{ ok: true; data: SnsAnalyticsData } | { ok: false; message: string }> {
  try {
    if (!usingMockData()) return { ok: false, message: COMING_SOON };
    currentSnsData = {
      ...currentSnsData,
      account: {
        ...currentSnsData.account,
        lastSyncedAt: new Date().toISOString(),
      },
      overview: {
        ...currentSnsData.overview,
        totalReach: currentSnsData.overview.totalReach + Math.floor(Math.random() * 200),
        avgSaves: currentSnsData.overview.avgSaves + (Math.random() > 0.5 ? 1 : 0),
      },
    };
    revalidatePath("/settings");
    return { ok: true, data: currentSnsData };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "성과 데이터를 갱신하지 못했습니다." };
  }
}

export async function updateMediaKitAction(
  input: Partial<MediaKitSummary>,
): Promise<{ ok: true; data: MediaKitSummary } | { ok: false; message: string }> {
  try {
    if (!usingMockData()) return { ok: false, message: "협찬 미디어킷은 출시 예정이에요." };
    currentSnsData = {
      ...currentSnsData,
      mediaKit: {
        ...currentSnsData.mediaKit,
        ...input,
      },
    };
    revalidatePath("/settings");
    return { ok: true, data: currentSnsData.mediaKit };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "미디어킷 정보를 저장하지 못했습니다." };
  }
}

