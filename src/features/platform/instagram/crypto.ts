import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * 인스타 장기 토큰 암호화(AES-256-GCM). DB 에는 `v1.<iv>.<tag>.<본문>`(base64url)만 둔다.
 * 키는 INSTAGRAM_TOKEN_KEY(32바이트 base64). 키를 바꾸면 기존 연결은 다시 로그인해야 한다.
 * Meta 플랫폼 약관 §6.a.iv(토큰·앱 시크릿 보호).
 */

function keyFrom(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("INSTAGRAM_TOKEN_KEY 는 32바이트를 base64 로 적어야 해요. (openssl rand -base64 32)");
  return key;
}

export function encryptToken(plain: string, base64Key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(base64Key), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

export function decryptToken(sealed: string, base64Key: string): string {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("저장된 인스타 토큰 형식이 아니에요.");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(base64Key), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
