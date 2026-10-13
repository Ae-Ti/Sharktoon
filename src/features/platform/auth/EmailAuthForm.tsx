"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field } from "@/components/ui";

export interface EmailAuthFormProps {
  configured: boolean;
  initialMode?: "signin" | "signup";
}

export function EmailAuthForm({ configured, initialMode = "signin" }: EmailAuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!email || !email.includes("@")) {
      setMessage({ text: "올바른 이메일 주소를 입력해 주세요.", isError: true });
      return;
    }

    if (!password || password.length < 6) {
      setMessage({ text: "비밀번호는 최소 6자 이상이어야 해요.", isError: true });
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setMessage({ text: "비밀번호가 일치하지 않아요.", isError: true });
      return;
    }

    startTransition(async () => {
      const { setSessionAction } = await import("./actions");

      if (!configured) {
        // Supabase 미연결(Mock 모드): 즉시 로그인/가입 처리 및 세션 쿠키 저장
        await setSessionAction({ email, role: "user" });
        setMessage({
          text:
            mode === "signup"
              ? "회원가입이 완료되었어요! 온보딩으로 이동합니다."
              : "로그인되었습니다.",
          isError: false,
        });
        setTimeout(() => {
          if (mode === "signup") {
            router.push("/onboarding/character");
          } else {
            router.push("/home");
          }
          router.refresh();
        }, 300);
        return;
      }

      try {
        const { createClient } = await import("@/lib/supabase/client");
        const db = createClient();

        if (mode === "signup") {
          const { data, error } = await db.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding/character`,
            },
          });
          if (error) {
            setMessage({ text: error.message, isError: true });
            return;
          }
          if (data.session) {
            router.push("/onboarding/character");
            router.refresh();
          } else {
            setMessage({
              text: "인증 메일이 발송되었어요. 이메일을 확인하거나 로그인해 주세요.",
              isError: false,
            });
          }
        } else {
          const { error } = await db.auth.signInWithPassword({
            email,
            password,
          });
          if (error) {
            setMessage({ text: error.message, isError: true });
            return;
          }
          router.push("/home");
          router.refresh();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "로그인 처리 중 오류가 발생했습니다.";
        setMessage({ text: msg, isError: true });
      }
    });
  }

  function handleDemoUser(role: "user" | "admin", target?: "onboarding" | "home" | "admin") {
    setMessage(null);
    startTransition(async () => {
      const { setSessionAction } = await import("./actions");
      const demoEmail = role === "admin" ? "admin@sharktoon.com" : "user@sharktoon.com";
      await setSessionAction({ email: demoEmail, role });
      const dest =
        role === "admin" || target === "admin"
          ? "/admin"
          : target === "onboarding" || (mode === "signup" && !target)
            ? "/onboarding/character"
            : "/home";
      router.push(dest);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-5 shadow-xs">
      {/* 탭: 로그인 / 회원가입 */}
      <div className="flex rounded-lg bg-surface-sunken p-1">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setMessage(null);
          }}
          className={`flex-1 rounded-md py-2 text-center text-label font-semibold transition-all ${
            mode === "signin"
              ? "bg-surface-card text-ink shadow-xs"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setMessage(null);
          }}
          className={`flex-1 rounded-md py-2 text-center text-label font-semibold transition-all ${
            mode === "signup"
              ? "bg-surface-card text-ink shadow-xs"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          회원가입
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field
          label="이메일"
          value={email}
          onChange={setEmail}
          placeholder="user@example.com"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-caption font-medium text-ink-muted">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6자 이상 입력"
            className="h-control-md rounded-lg border border-border-control bg-surface-card px-3 text-body text-ink transition-colors placeholder:text-ink-subtle focus:border-brand focus:outline-hidden"
          />
        </div>

        {mode === "signup" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-caption font-medium text-ink-muted">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 다시 입력"
              className="h-control-md rounded-lg border border-border-control bg-surface-card px-3 text-body text-ink transition-colors placeholder:text-ink-subtle focus:border-brand focus:outline-hidden"
            />
          </div>
        )}

        {message && (
          <p
            className={`text-body-sm font-medium ${
              message.isError ? "text-danger" : "text-brand"
            }`}
          >
            {message.text}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          variant="primary"
          block
          loading={pending}
        >
          {mode === "signin" ? "이메일로 로그인" : "무료로 가입하고 8크레딧 받기"}
        </Button>
      </form>

      {/* 데모/체험 빠른 접속 안내 */}
      <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-3 text-caption text-ink-subtle">
        <span>빠른 체험:</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDemoUser("user", "onboarding")}
            className="cursor-pointer font-semibold text-brand hover:underline"
          >
            🚀 온보딩 시작
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => handleDemoUser("user", "home")}
            className="cursor-pointer text-ink-muted hover:text-ink hover:underline"
          >
            홈
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => handleDemoUser("admin", "admin")}
            className="cursor-pointer text-ink-muted hover:text-ink hover:underline"
          >
            관리자
          </button>
        </div>
      </div>
    </div>
  );
}

