import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * 소셜 로그인 리다이렉트 지점. Supabase 가 코드를 붙여 돌려보내면
 * 세션으로 바꾸고 온보딩으로 보낸다.
 *
 * 앱(Capacitor)에서는 커스텀 URL 스킴 딥링크가 이 자리를 대신한다.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/onboarding/character";

  if (!isSupabaseConfigured()) {
    // 아직 프로젝트가 없다. 화면 흐름만 이어 준다.
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (code) {
    const { createClient } = await import("@/lib/supabase/server");
    const db = await createClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
