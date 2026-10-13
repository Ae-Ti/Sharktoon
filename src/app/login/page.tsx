import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { EmailAuthForm } from "@/features/platform/auth/EmailAuthForm";
import { getSession } from "@/features/platform/auth/session";

export const metadata: Metadata = {
  title: "로그인 · 샥툰",
  description: "샥툰 이메일 로그인 및 회원가입",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/home");
  }

  const { mode } = await searchParams;
  const configured = isSupabaseConfigured();
  const initialMode = mode === "signup" ? "signup" : "signin";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 pt-12 pb-8">
      <div className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-[36px] leading-none font-extrabold tracking-[-0.04em] text-brand">
          샥툰
        </Link>
        <p className="text-body text-ink-muted">
          {initialMode === "signup"
            ? "간편하게 가입하고 나만의 인스타툰을 시작하세요."
            : "로그인하고 나만의 인스타툰을 이어 그려보세요."}
        </p>
      </div>

      <div className="my-6 flex flex-col gap-4">
        <EmailAuthForm configured={configured} initialMode={initialMode} />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-center text-body-sm text-ink-muted">
          가입하면 <Link href="/terms" className="text-brand-ink underline">이용약관</Link>과{" "}
          <Link href="/privacy" className="text-brand-ink underline">개인정보 처리방침</Link>에 동의하게 돼요.
        </p>
        <p className="text-center text-caption text-ink-subtle">
          샥툰은 생성형 AI로 콘티·그림·캡션을 만들어요. 만든 이미지에는 AI 생성 표시가 들어가요.
        </p>
      </div>
    </main>
  );
}
