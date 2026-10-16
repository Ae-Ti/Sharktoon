import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { IG_STATE_COOKIE, instagramAvailable, requireInstagramConfig } from "@/features/platform/instagram/config";
import { authorizeUrl } from "@/features/platform/instagram/graph";
import { createClient } from "@/lib/supabase/server";

/**
 * 인스타그램 로그인 시작(Business Login for Instagram). 로그인한 샥툰 사용자만.
 * 앱 심사 전에는 Meta 앱 대시보드에 역할로 등록된 인스타 계정만 승인 화면을 통과한다.
 */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  if (!instagramAvailable()) {
    return NextResponse.redirect(new URL("/settings?tab=0&instagram=unavailable", origin));
  }
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", origin));

  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(requireInstagramConfig(), state));
  res.cookies.set(IG_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/instagram",
    maxAge: 600,
  });
  return res;
}
