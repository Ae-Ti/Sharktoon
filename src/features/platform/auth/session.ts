import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const SESSION_COOKIE = "sharktoon_session";

export interface SharktoonSession {
  userId: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  isAdmin: boolean;
}

export async function getSession(): Promise<SharktoonSession | null> {
  const cookieStore = await cookies();

  // 1. Supabase가 설정되어 있는 경우 Supabase Auth 세션 우선 확인
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (!error && user) {
        // 운영자 판정은 서버만 바꿀 수 있는 값으로만 한다. user_metadata 는 사용자가
        // supabase.auth.updateUser 로 직접 고칠 수 있고, 이메일 주소는 권한이 아니다.
        // 운영 집계 함수(SK004)도 같은 profiles.is_admin 을 본다.
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();
        const isAdmin = user.app_metadata?.role === "admin" || profile?.is_admin === true;
        return {
          userId: user.id,
          email: user.email || "",
          displayName:
            user.user_metadata?.displayName ||
            user.email?.split("@")[0] ||
            "작가",
          role: isAdmin ? "admin" : "user",
          isAdmin,
        };
      }
    } catch {
      // 연결 오류. 아래 데모 쿠키로 넘어가지 않는다 — 실 저장소에서 데모 쿠키는 아무 권한이 없다.
    }
    return null;
  }

  // 2. Mock 모드 전용 데모 세션 쿠키. 브라우저가 고칠 수 있으므로 실 저장소에서는 쓰지 않는다.
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(sessionCookie));
    if (parsed && typeof parsed.email === "string") {
      const isAdmin =
        parsed.role === "admin" ||
        parsed.isAdmin === true ||
        parsed.email === "admin@sharktoon.com";
      return {
        userId: parsed.userId || "usr_demo",
        email: parsed.email,
        displayName:
          parsed.displayName || parsed.email.split("@")[0] || "작가",
        role: isAdmin ? "admin" : "user",
        isAdmin,
      };
    }
  } catch {
    // Malformed JSON cookie
  }

  return null;
}

