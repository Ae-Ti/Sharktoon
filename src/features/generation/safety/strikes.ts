import "server-only";

import { dataSource } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { processSingleton } from "@/lib/singleton";

/**
 * 콘텐츠 안전 판정 기록과 반복 시 이용 제한(마이그레이션 0011).
 *
 * 이미지 안전 검사에는 오탐이 섞여 있어(평범한 "등 때리기" 장면도 걸린다) 걸린 컷은 실패로 닫고
 * 크레딧을 돌려준다. 대신 판정을 남기고, 24시간 안에 STRIKE_LIMIT 번 걸리면 그 뒤로는 생성을 잠시
 * 막는다. 막힌 사용자는 운영자 검토(/admin)와 이의 제기로 푼다(약관 이용 제한 절차).
 */

export const STRIKE_LIMIT = 3;
export const STRIKE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** 처리방침의 보관 기간. */
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export type SafetyEventKind = "text_blocked" | "image_flagged";

export interface SafetyEventInput {
  ownerId: string;
  kind: SafetyEventKind;
  source: string;
  category?: string | null;
  episodeId?: string | null;
  cutId?: string | null;
  jobId?: string | null;
}

export interface SafetyEventView extends SafetyEventInput {
  id: number;
  createdAt: string;
}

const mem = processSingleton("safety-events-mock", () => ({ rows: [] as SafetyEventView[], seq: 0 }));

/** 판정을 남긴다. 기록이 실패해도 생성 흐름은 막지 않는다. */
export async function recordSafetyEvent(input: SafetyEventInput): Promise<void> {
  try {
    if (dataSource() === "mock") {
      mem.rows.unshift({ ...input, id: ++mem.seq, createdAt: new Date().toISOString() });
      return;
    }
    const db = createServiceClient();
    const { error } = await db.from("safety_events").insert({
      owner_id: input.ownerId,
      kind: input.kind,
      source: input.source,
      category: input.category ?? null,
      // 목 회차 id 는 uuid 가 아니다. 실 저장소에서만 회차를 잇는다.
      episode_id: input.episodeId ?? null,
      cut_id: input.cutId ?? null,
      job_id: input.jobId ?? null,
    });
    if (error) throw error;
  } catch (e) {
    console.error("[safety] 판정 기록 실패", e);
  }
}

async function recentImageFlags(ownerId: string): Promise<number> {
  const since = new Date(Date.now() - STRIKE_WINDOW_MS).toISOString();
  if (dataSource() === "mock") {
    return mem.rows.filter((r) => r.ownerId === ownerId && r.kind === "image_flagged" && r.createdAt >= since).length;
  }
  const db = createServiceClient();
  const { count, error } = await db
    .from("safety_events")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("kind", "image_flagged")
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

/** 생성이 잠시 막혔으면 사용자에게 보여줄 문구를, 아니면 null. */
export async function safetyLockMessage(ownerId: string): Promise<string | null> {
  const flags = await recentImageFlags(ownerId);
  if (flags < STRIKE_LIMIT) return null;
  return `최근 24시간 동안 이미지 안전 검사에 ${flags}번 걸려 생성을 잠시 멈췄어요. 24시간 뒤 다시 이용할 수 있고, 판정이 잘못됐다면 문의로 이의를 제기해 주세요.`;
}

/** 운영자 검토용 최근 판정. 운영자가 아니면 RLS 가 본인 것만 돌려준다. */
export async function listRecentSafetyEvents(limit = 30): Promise<SafetyEventView[]> {
  if (dataSource() === "mock") return mem.rows.slice(0, limit);
  const db = await createClient();
  const { data, error } = await db
    .from("safety_events")
    .select("id, owner_id, kind, source, category, episode_id, cut_id, job_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    kind: r.kind,
    source: r.source,
    category: r.category,
    episodeId: r.episode_id,
    cutId: r.cut_id,
    jobId: r.job_id,
    createdAt: r.created_at,
  }));
}

/** 보관 기간(1년)이 지난 판정을 지운다. 하루 한 번 크론이 부른다. */
export async function purgeOldSafetyEvents(): Promise<number> {
  if (dataSource() === "mock") return 0;
  const db = createServiceClient();
  const { data, error } = await db
    .from("safety_events")
    .delete()
    .lt("created_at", new Date(Date.now() - RETENTION_MS).toISOString())
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
