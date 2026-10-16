"use server";

import { revalidatePath } from "next/cache";
import { INITIAL_MOCK_SNS_DATA } from "./mockData";
import type { SnsAnalyticsData, MediaKitSummary } from "./types";

let currentSnsData: SnsAnalyticsData = { ...INITIAL_MOCK_SNS_DATA };

export async function getSnsAnalyticsAction(): Promise<{ ok: true; data: SnsAnalyticsData } | { ok: false; message: string }> {
  try {
    return { ok: true, data: currentSnsData };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "SNS 성과 데이터를 불러오지 못했습니다." };
  }
}

export async function connectInstagramAction(username: string): Promise<{ ok: true; data: SnsAnalyticsData } | { ok: false; message: string }> {
  try {
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

