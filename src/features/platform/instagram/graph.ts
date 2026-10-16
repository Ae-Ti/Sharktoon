import "server-only";

import { IG_PUBLISH_LIMIT_FALLBACK } from "@/contracts/instagram";
import { IG_GRAPH_HOST, IG_GRAPH_VERSION, IG_SCOPES, type InstagramConfig } from "./config";

/**
 * Instagram Graph API 얇은 클라이언트(Instagram Login, graph.instagram.com).
 * 화면과 DB 를 모른다. 토큰은 평문으로 받아 쓰고 어디에도 남기지 않는다.
 *
 * 문서: content-publishing, ig-user/media, business-login (2026-10-16, v25.0).
 */

export class IgApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
    this.name = "IgApiError";
  }

  /** 토큰이 만료·폐기됐다. 다시 로그인해야 한다. */
  get needsReconnect(): boolean {
    return this.code === 190;
  }

  /** 잠시 뒤 다시 하면 되는 실패(호출량 초과, 일시 오류, 하루 게시 한도). */
  get retryable(): boolean {
    if (this.status >= 500) return true;
    if (this.code === 9 && this.subcode === 2207042) return true; // 24시간 게시 한도
    return [1, 2, 4, 17, 32, 341, 613, 80002].includes(this.code ?? -1);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

function form(params: Params): URLSearchParams {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v));
  return body;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // 아래에서 본문 그대로 오류로 올린다.
  }
  const err = (json as { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } } | null)?.error;
  if (!res.ok || err) {
    const message = err?.error_user_msg || err?.message || text.slice(0, 300) || `HTTP ${res.status}`;
    throw new IgApiError(message, res.status, err?.code, err?.error_subcode);
  }
  return json as T;
}

const api = (path: string) => `${IG_GRAPH_HOST}/${IG_GRAPH_VERSION}${path}`;

function get<T>(path: string, token: string, params: Params = {}): Promise<T> {
  return call<T>(`${api(path)}?${form({ ...params, access_token: token })}`);
}

function post<T>(path: string, token: string, params: Params): Promise<T> {
  return call<T>(api(path), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ ...params, access_token: token }),
  });
}

// ─── 로그인 ───────────────────────────────────────────────────────────────

export function authorizeUrl(config: InstagramConfig, state: string): string {
  const q = form({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: IG_SCOPES.join(","),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

/** 인가 코드(1시간, 1회용) → 단기 토큰(1시간). */
export async function exchangeCode(
  config: InstagramConfig,
  code: string,
): Promise<{ accessToken: string; userId: string; permissions: string[] }> {
  type Short = { access_token: string; user_id: string | number; permissions?: string | string[] };
  const res = await call<Short | { data: Short[] }>("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code,
    }),
  });
  const row = "data" in res ? res.data[0] : res;
  if (!row?.access_token) throw new IgApiError("인스타 로그인 응답에 토큰이 없어요.", 502);
  const permissions = Array.isArray(row.permissions)
    ? row.permissions
    : String(row.permissions ?? "").split(",").filter(Boolean);
  return { accessToken: row.access_token, userId: String(row.user_id), permissions };
}

/** 단기 토큰 → 장기 토큰(60일). 서버에서만 부른다(앱 시크릿). */
export async function exchangeLongLived(
  config: InstagramConfig,
  shortToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await call<{ access_token: string; expires_in: number }>(
    `${IG_GRAPH_HOST}/access_token?${form({
      grant_type: "ig_exchange_token",
      client_secret: config.appSecret,
      access_token: shortToken,
    })}`,
  );
  return { accessToken: res.access_token, expiresIn: res.expires_in };
}

/** 장기 토큰 갱신. 발급 24시간 뒤부터, 만료 전에만 된다. */
export async function refreshLongLived(token: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await call<{ access_token: string; expires_in: number }>(
    `${IG_GRAPH_HOST}/refresh_access_token?${form({ grant_type: "ig_refresh_token", access_token: token })}`,
  );
  return { accessToken: res.access_token, expiresIn: res.expires_in };
}

export interface IgProfile {
  igUserId: string;
  username: string;
  /** Business | Media_Creator. 개인 계정은 Instagram Login 자체가 안 된다. */
  accountType: string | null;
}

export async function getMe(token: string): Promise<IgProfile> {
  const me = await get<{ user_id?: string | number; id?: string; username: string; account_type?: string }>(
    "/me",
    token,
    { fields: "user_id,username,account_type" },
  );
  return { igUserId: String(me.user_id ?? me.id), username: me.username, accountType: me.account_type ?? null };
}

// ─── 게시 ─────────────────────────────────────────────────────────────────

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "PUBLISHED" | "ERROR" | "EXPIRED";

/** 이미지 1장 컨테이너. 캐러셀 자식이면 캡션·AI 라벨을 붙이지 않는다(붙이면 오류). */
export async function createImageContainer(
  token: string,
  igUserId: string,
  input: { imageUrl: string; carouselItem: boolean; caption?: string; isAiGenerated?: boolean },
): Promise<string> {
  const res = await post<{ id: string }>(`/${igUserId}/media`, token, {
    image_url: input.imageUrl,
    is_carousel_item: input.carouselItem ? true : undefined,
    caption: input.carouselItem ? undefined : input.caption,
    is_ai_generated: input.carouselItem ? undefined : input.isAiGenerated,
  });
  return res.id;
}

export async function createCarouselContainer(
  token: string,
  igUserId: string,
  input: { children: string[]; caption: string; isAiGenerated: boolean },
): Promise<string> {
  const res = await post<{ id: string }>(`/${igUserId}/media`, token, {
    media_type: "CAROUSEL",
    children: input.children.join(","),
    caption: input.caption,
    is_ai_generated: input.isAiGenerated,
  });
  return res.id;
}

export async function containerStatus(token: string, containerId: string): Promise<{ code: ContainerStatus; detail?: string }> {
  const res = await get<{ status_code: ContainerStatus; status?: string }>(`/${containerId}`, token, {
    fields: "status_code,status",
  });
  return { code: res.status_code, detail: res.status };
}

export async function publishContainer(token: string, igUserId: string, containerId: string): Promise<string> {
  const res = await post<{ id: string }>(`/${igUserId}/media_publish`, token, { creation_id: containerId });
  return res.id;
}

export async function mediaPermalink(token: string, mediaId: string): Promise<string | null> {
  const res = await get<{ permalink?: string }>(`/${mediaId}`, token, { fields: "permalink" });
  return res.permalink ?? null;
}

export async function postComment(token: string, mediaId: string, message: string): Promise<string> {
  const res = await post<{ id: string }>(`/${mediaId}/comments`, token, { message });
  return res.id;
}

/** 지난 24시간 게시 수와 한도. 읽지 못하면 문서의 보수적인 값으로 본다. */
export async function publishingQuota(token: string, igUserId: string): Promise<{ used: number; total: number }> {
  try {
    const res = await get<{ data: { quota_usage?: number; config?: { quota_total?: number } }[] }>(
      `/${igUserId}/content_publishing_limit`,
      token,
      { fields: "quota_usage,config" },
    );
    const row = res.data?.[0];
    return { used: row?.quota_usage ?? 0, total: row?.config?.quota_total ?? IG_PUBLISH_LIMIT_FALLBACK };
  } catch (e) {
    if (e instanceof IgApiError && e.needsReconnect) throw e;
    return { used: 0, total: IG_PUBLISH_LIMIT_FALLBACK };
  }
}
