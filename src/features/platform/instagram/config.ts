import "server-only";

import { dataSource } from "@/lib/supabase/env";

/**
 * 인스타그램 연동 설정. Instagram API with Instagram Login(페이스북 페이지 불필요).
 *
 * 키가 전부 있어야 켜진다. 앱 심사(Advanced Access)·비즈니스 인증 전에는 Meta 앱 대시보드에서
 * 역할(테스터)로 등록한 계정만 로그인할 수 있다. 화면 노출은 `INSTAGRAM_PUBLISH_ENABLED` 로 따로 막는다.
 */

/** Meta 문서 기준 최신 버전(2026-10-16). 올릴 때는 변경 로그의 폐지 지표를 먼저 본다. */
export const IG_GRAPH_VERSION = "v25.0";
export const IG_GRAPH_HOST = "https://graph.instagram.com";

/** 로그인 콜백에서 맞춰 보는 CSRF 값을 담는 쿠키. 10분 안에 돌아와야 한다. */
export const IG_STATE_COOKIE = "ig_oauth_state";

/**
 * 요청하는 권한. 쓰지 않는 권한을 넣으면 앱 심사에서 반려된다(App Review 가이드).
 * 성과 수집(instagram_business_manage_insights)은 그 기능을 만들 때 넣는다.
 */
export const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
] as const;

export interface InstagramConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  /** 토큰 암호화 키. 32바이트를 base64 로. */
  tokenKey: string;
}

export function instagramConfig(): InstagramConfig | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  const tokenKey = process.env.INSTAGRAM_TOKEN_KEY;
  if (!appId || !appSecret || !redirectUri || !tokenKey) return null;
  return { appId, appSecret, redirectUri, tokenKey };
}

/**
 * 실제 연동을 쓸 수 있는가. 목 모드는 Storage 가 없어 Meta 가 이미지를 가져갈 공개 URL 을 못 만든다.
 */
export function instagramAvailable(): boolean {
  return dataSource() === "supabase" && instagramConfig() !== null;
}

/**
 * 화면에 실제 발행 버튼을 보여줄지. 사업자 등록·앱 심사 전에는 꺼 둔다("출시 예정").
 * 켜도 앱에 역할로 등록된 계정만 연결된다 — 개발자 본인 시험용이다.
 */
export function instagramPublishEnabled(): boolean {
  return process.env.INSTAGRAM_PUBLISH_ENABLED === "true" && instagramAvailable();
}

export function requireInstagramConfig(): InstagramConfig {
  const config = instagramConfig();
  if (!config) throw new Error("인스타그램 연동 설정(INSTAGRAM_APP_ID 등)이 없어요. .env.example 참고.");
  return config;
}
