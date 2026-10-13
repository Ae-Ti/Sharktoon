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
        const isAdmin =
          user.app_metadata?.role === "admin" ||
          user.user_metadata?.role === "admin" ||
          user.email === "admin@sharktoon.com";
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
      // Supabase 연결 에러 시 쿠키 세션 확인으로 폴백
    }
  }

  // 2. Mock 모드 및 데모 세션 쿠키 확인
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

