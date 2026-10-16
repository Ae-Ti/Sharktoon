import { NextResponse, type NextRequest } from "next/server";
import { saveConnection } from "@/features/platform/instagram/accounts";
import { IG_STATE_COOKIE, instagramAvailable, requireInstagramConfig } from "@/features/platform/instagram/config";
import { IgApiError, exchangeCode, exchangeLongLived, getMe } from "@/features/platform/instagram/graph";
import { createClient } from "@/lib/supabase/server";

/**
 * 인스타그램 로그인 리다이렉트 지점(INSTAGRAM_REDIRECT_URI 와 같아야 한다).
 * 코드 → 단기 토큰 → 장기 토큰(60일)으로 바꿔 암호화해 저장하고 설정 화면으로 돌려보낸다.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const back = (result: string) => {
    const res = NextResponse.redirect(new URL(`/settings?tab=0&instagram=${encodeURIComponent(result)}`, url.origin));
    res.cookies.delete({ name: IG_STATE_COOKIE, path: "/api/instagram" });
    return res;
  };

  if (!instagramAvailable()) return back("unavailable");
  // 사용자가 승인 화면에서 취소했다.
  if (url.searchParams.get("error")) return back("denied");

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!code || !state || state !== request.cookies.get(IG_STATE_COOKIE)?.value) return back("invalid_state");

  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", url.origin));

  try {
    const config = requireInstagramConfig();
    // Meta 가 코드 끝에 "#_" 를 붙여 보낼 때가 있다(문서).
    const short = await exchangeCode(config, code.replace(/#_$/, ""));
    const long = await exchangeLongLived(config, short.accessToken);
    const profile = await getMe(long.accessToken);
    await saveConnection({
      ownerId: data.user.id,
      profile,
      accessToken: long.accessToken,
      expiresIn: long.expiresIn,
      scopes: short.permissions,
    });
    return back("connected");
  } catch (e) {
    console.error("[instagram] 연결 실패", e);
    return back(e instanceof IgApiError ? "api_error" : "error");
  }
}
