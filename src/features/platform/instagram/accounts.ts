import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { removeObjects } from "@/lib/supabase/storage";
import { requireInstagramConfig } from "./config";
import { decryptToken, encryptToken } from "./crypto";
import { refreshLongLived, type IgProfile } from "./graph";

/**
 * 연결된 인스타 계정(마이그레이션 0009). 토큰은 서비스 롤로만 읽고 쓴다.
 * 화면에 넘기는 값에는 토큰이 없다.
 */

export interface InstagramAccountView {
  igUserId: string;
  username: string;
  accountType: string | null;
  tokenExpiresAt: string;
  connectedAt: string;
}

export async function saveConnection(input: {
  ownerId: string;
  profile: IgProfile;
  accessToken: string;
  expiresIn: number;
  scopes: string[];
}): Promise<void> {
  const config = requireInstagramConfig();
  const db = createServiceClient();
  const now = new Date();
  // 같은 인스타 계정을 다른 샥툰 계정이 쥐고 있었다면 그 연결을 끊는다(한 계정은 한 사람에게만).
  await db.from("instagram_accounts").delete().eq("ig_user_id", input.profile.igUserId).neq("owner_id", input.ownerId);
  const { error } = await db.from("instagram_accounts").upsert({
    owner_id: input.ownerId,
    ig_user_id: input.profile.igUserId,
    username: input.profile.username,
    account_type: input.profile.accountType,
    access_token_enc: encryptToken(input.accessToken, config.tokenKey),
    token_expires_at: new Date(now.getTime() + input.expiresIn * 1000).toISOString(),
    token_refreshed_at: now.toISOString(),
    scopes: input.scopes,
    connected_at: now.toISOString(),
  });
  if (error) throw error;
}

export async function getAccount(ownerId: string): Promise<InstagramAccountView | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("instagram_accounts")
    .select("ig_user_id, username, account_type, token_expires_at, connected_at")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!data) return null;
  return {
    igUserId: data.ig_user_id,
    username: data.username,
    accountType: data.account_type,
    tokenExpiresAt: data.token_expires_at,
    connectedAt: data.connected_at,
  };
}

/** 발행 작업자용. 토큰이 만료됐으면 null — 사용자가 다시 로그인해야 한다. */
export async function credentialsFor(ownerId: string): Promise<{ token: string; igUserId: string } | null> {
  const config = requireInstagramConfig();
  const db = createServiceClient();
  const { data } = await db
    .from("instagram_accounts")
    .select("ig_user_id, access_token_enc, token_expires_at")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!data || new Date(data.token_expires_at).getTime() <= Date.now()) return null;
  return { token: decryptToken(data.access_token_enc, config.tokenKey), igUserId: data.ig_user_id };
}

/**
 * 연결 해제. 대기 중인 발행을 취소하고, 발행용 이미지와 토큰을 지운다.
 * Meta 플랫폼 약관 §3.d: 사용자가 연결을 끊으면 플랫폼 데이터를 지운다.
 */
export async function disconnect(ownerId: string): Promise<void> {
  const db = createServiceClient();
  const { data: pending } = await db
    .from("instagram_publish_jobs")
    .update({ status: "canceled", error: "인스타그램 연결을 해제했어요.", lease_until: null })
    .eq("owner_id", ownerId)
    .in("status", ["queued", "running"])
    .select("image_paths");
  const paths = (pending ?? []).flatMap((j) => j.image_paths);
  if (paths.length > 0) await removeObjects("publish", paths.filter((p) => p.startsWith(`${ownerId}/`)));
  const { error } = await db.from("instagram_accounts").delete().eq("owner_id", ownerId);
  if (error) throw error;
}

/** 갱신 여유. 만료 10일 전부터 갱신한다(하루 한 번 크론이 실패해도 몇 번 더 기회가 있다). */
const REFRESH_WITHIN_MS = 10 * 86_400_000;
/** 장기 토큰은 발급 24시간이 지나야 갱신된다. */
const MIN_AGE_MS = 86_400_000;

/** 만료가 가까운 토큰을 갱신한다. 하루 한 번 크론이 부른다. 갱신한 수를 돌려준다. */
export async function refreshExpiringTokens(): Promise<number> {
  const config = requireInstagramConfig();
  const db = createServiceClient();
  const now = Date.now();
  const { data, error } = await db
    .from("instagram_accounts")
    .select("owner_id, access_token_enc, token_expires_at, token_refreshed_at")
    .lt("token_expires_at", new Date(now + REFRESH_WITHIN_MS).toISOString())
    .gt("token_expires_at", new Date(now).toISOString())
    .lt("token_refreshed_at", new Date(now - MIN_AGE_MS).toISOString());
  if (error) throw error;

  let refreshed = 0;
  for (const row of data ?? []) {
    try {
      const next = await refreshLongLived(decryptToken(row.access_token_enc, config.tokenKey));
      await db
        .from("instagram_accounts")
        .update({
          access_token_enc: encryptToken(next.accessToken, config.tokenKey),
          token_expires_at: new Date(Date.now() + next.expiresIn * 1000).toISOString(),
          token_refreshed_at: new Date().toISOString(),
        })
        .eq("owner_id", row.owner_id);
      refreshed++;
    } catch (e) {
      console.error("[instagram] 토큰 갱신 실패", row.owner_id, e);
    }
  }
  return refreshed;
}
