"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field } from "@/components/ui";

/**
 * 로컬에서 실제 저장소를 테스트하기 위한 이메일 로그인.
 *
 * 카카오·구글 OAuth 앱이 아직 없어도 실제 Supabase 경로(RLS, 크레딧 RPC,
 * 진짜 쓰기)를 끝까지 돌려볼 수 있어야 한다.
 * 프로덕션 빌드에서는 렌더되지 않는다 — 부모가 NODE_ENV 로 막는다.
 */
export function DevEmailLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("test@sharktoon.local");
  const [password, setPassword] = useState("sharktoon1234");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(mode: "signup" | "signin") {
    setMessage(null);
    start(async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const db = createClient();
      const { error } =
        mode === "signup"
          ? await db.auth.signUp({ email, password })
          : await db.auth.signInWithPassword({ email, password });

      if (error) {
        setMessage(error.message);
        return;
      }
      router.push("/onboarding/character");
      router.refresh();
    });
  }

  return (
    <details className="rounded-lg border border-dashed border-border-control p-4">
      <summary className="cursor-pointer text-label font-semibold text-ink-muted">
        개발용 이메일 로그인
      </summary>
      <div className="flex flex-col gap-3 pt-4">
        <p className="text-body-sm text-ink-muted">
          로컬 Supabase 에서 실제 경로를 테스트할 때만 쓴다. 프로덕션 빌드에는 없다.
        </p>
        <Field label="이메일" value={email} onChange={setEmail} />
        <Field label="비밀번호" value={password} onChange={setPassword} />
        <div className="flex gap-2">
          <Button variant="secondary" block loading={pending} onClick={() => run("signup")}>
            가입
          </Button>
          <Button variant="secondary" block loading={pending} onClick={() => run("signin")}>
            로그인
          </Button>
        </div>
        {message && <p className="text-body-sm text-danger">{message}</p>}
      </div>
    </details>
  );
}
