"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export interface LoginButtonsProps {
  /** Supabase 키가 없으면 로그인 없이 온보딩으로 넘긴다. 화면을 먼저 만들기 위해서다. */
  configured: boolean;
}

export function LoginButtons({ configured }: LoginButtonsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"kakao" | "google" | null>(null);

  async function signIn(provider: "kakao" | "google") {
    setBusy(provider);
    if (!configured) {
      router.push("/onboarding/character");
      return;
    }
    const { createClient } = await import("@/lib/supabase/client");
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        // 앱(Capacitor)에서는 커스텀 URL 스킴 딥링크로 바꾼다.
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding/character`,
      },
    });
    if (error) setBusy(null);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Button
        size="lg"
        variant="secondary"
        block
        loading={busy === "kakao"}
        onClick={() => signIn("kakao")}
      >
        카카오로 시작하기
      </Button>
      <Button
        size="lg"
        variant="secondary"
        block
        loading={busy === "google"}
        onClick={() => signIn("google")}
      >
        구글로 시작하기
      </Button>
    </div>
  );
}
