"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SESSION_COOKIE, type SharktoonSession } from "./session";

export async function setSessionAction(data: {
  email: string;
  role?: "user" | "admin";
  displayName?: string;
}): Promise<SharktoonSession> {
  // 데모 세션은 목 모드에서만. 실 저장소에서 이 쿠키로 로그인·운영자 행세를 하지 못하게 막는다.
  if (isSupabaseConfigured()) throw new Error("데모 로그인은 목 모드에서만 쓸 수 있어요.");
  const cookieStore = await cookies();
  const isAdmin = data.role === "admin" || data.email === "admin@sharktoon.com";
  const session: SharktoonSession = {
    userId: isAdmin ? "usr_admin" : "usr_demo",
    email: data.email,
    displayName:
      data.displayName || data.email.split("@")[0] || (isAdmin ? "어드민" : "작가"),
    role: isAdmin ? "admin" : "user",
    isAdmin,
  };

  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7일 유지
  });

  return session;
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }

  redirect("/login");
}

