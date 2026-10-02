import "server-only";

import { createServiceClient } from "./service";

/**
 * 비공개 버킷 두 개. 업로드와 서명 URL 발급은 전부 서버가 한다.
 *   cuts   — {owner}/{episode}/{cut}.{ext}
 *   assets — {owner}/{asset}/{name}.{ext}
 */
export type Bucket = "cuts" | "assets";

/** 서명 URL 수명. 편집기를 한 시간 넘게 열어 두면 새로고침으로 다시 받는다. */
const SIGNED_URL_TTL = 60 * 60;

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export function extensionOf(contentType: string): string {
  return EXT_BY_TYPE[contentType] ?? "bin";
}

export async function uploadObject(
  bucket: Bucket,
  path: string,
  body: Uint8Array,
  contentType: string,
): Promise<string> {
  const db = createServiceClient();
  const { error } = await db.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

export async function removeObjects(bucket: Bucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const db = createServiceClient();
  const { error } = await db.storage.from(bucket).remove(paths);
  if (error) throw error;
}

/**
 * 서명 URL. **소유자 경로만** 서명한다.
 *
 * 경로 문자열은 DB 에 있고, 행 소유자는 RLS 로 확인되지만 경로 값 자체는 사용자가
 * 넣을 수 있는 열이 있다(에셋 레퍼런스). 남의 파일 경로를 적어 두고 서명을 받아 가지
 * 못하게 `{owner}/` 로 시작하는 것만 서명한다.
 */
export async function signedUrls(
  bucket: Bucket,
  ownerId: string,
  paths: string[],
): Promise<Map<string, string>> {
  const own = [...new Set(paths.filter((p) => p.startsWith(`${ownerId}/`)))];
  const out = new Map<string, string>();
  if (own.length === 0) return out;

  const db = createServiceClient();
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrls(own, SIGNED_URL_TTL);
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}

/**
 * 생성기가 돌려준 이미지를 바이트로 바꾼다. data URI(목 생성기)와 http(s) URL(실제 모델) 둘 다 받는다.
 */
export async function bytesFromImageUrl(
  url: string,
): Promise<{ body: Uint8Array; contentType: string }> {
  // data:image/svg+xml;charset=utf-8,<...> 처럼 메타 부분에 매개변수가 여러 개 붙는다.
  const data = /^data:([^,]*),([\s\S]*)$/.exec(url);
  if (data) {
    const [, meta, payload] = data;
    const body = meta.split(";").includes("base64")
      ? Uint8Array.from(Buffer.from(payload, "base64"))
      : new TextEncoder().encode(decodeURIComponent(payload));
    return { body, contentType: meta.split(";")[0] || "application/octet-stream" };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`이미지를 받지 못했어요 (${res.status})`);
  return {
    body: new Uint8Array(await res.arrayBuffer()),
    contentType: res.headers.get("content-type")?.split(";")[0] ?? "image/png",
  };
}
