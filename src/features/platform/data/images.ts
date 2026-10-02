import "server-only";

import { dataSource } from "@/lib/supabase/env";
import {
  bytesFromImageUrl,
  extensionOf,
  signedUrls,
  uploadObject,
  type Bucket,
} from "@/lib/supabase/storage";

/**
 * 이미지 저장소. 화면과 파이프라인은 "ref" 만 들고 다닌다.
 *
 * - Supabase: ref 는 비공개 버킷 안의 경로이고, 보여줄 때 서명 URL 로 바꾼다.
 * - 목: Storage 가 없으므로 ref 가 곧 data URI 다. 바꾸지 않고 그대로 쓴다.
 *
 * 어느 쪽이든 ref 를 URL 로 바꾸는 길은 `resolveImages` 하나다.
 */

/** 생성기가 돌려준 이미지(data URI 또는 http URL)를 저장하고 ref 를 돌려준다. */
export async function storeImage(input: {
  bucket: Bucket;
  ownerId: string;
  /** 소유자 폴더 아래 경로. 확장자는 내용을 보고 붙인다. */
  path: string;
  imageUrl: string;
}): Promise<string> {
  if (dataSource() === "mock") return input.imageUrl;

  const { body, contentType } = await bytesFromImageUrl(input.imageUrl);
  const full = `${input.ownerId}/${input.path}.${extensionOf(contentType)}`;
  return uploadObject(input.bucket, full, body, contentType);
}

/** 브라우저가 올린 파일. 셀카·에셋 레퍼런스. */
export async function storeUpload(input: {
  bucket: Bucket;
  ownerId: string;
  path: string;
  file: File;
}): Promise<string> {
  const contentType = input.file.type || "image/png";
  const body = new Uint8Array(await input.file.arrayBuffer());

  if (dataSource() === "mock") {
    return `data:${contentType};base64,${Buffer.from(body).toString("base64")}`;
  }

  const full = `${input.ownerId}/${input.path}.${extensionOf(contentType)}`;
  return uploadObject(input.bucket, full, body, contentType);
}

/** ref → 보여줄 URL. 서명하지 못한 ref(남의 경로)는 결과에 없다. */
export async function resolveImages(
  bucket: Bucket,
  ownerId: string,
  refs: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const paths: string[] = [];
  for (const ref of refs) {
    if (ref.startsWith("data:")) out.set(ref, ref);
    else paths.push(ref);
  }
  if (paths.length > 0 && dataSource() !== "mock") {
    for (const [path, url] of await signedUrls(bucket, ownerId, paths)) out.set(path, url);
  }
  return out;
}

/** 업로드 파일 검증. 서버 액션 본문 한도(next.config)와 버킷 한도에 맞춘다. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function checkUpload(file: unknown): File {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("사진을 골라 주세요.");
  }
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    throw new Error("PNG, JPG, WEBP 사진만 올릴 수 있어요.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("사진은 10MB 까지 올릴 수 있어요.");
  }
  return file;
}
