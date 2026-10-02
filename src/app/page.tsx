import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginButtons } from "@/features/platform/auth/LoginButtons";
import { DevEmailLogin } from "@/features/platform/auth/DevEmailLogin";

export default function Page() {
  const configured = isSupabaseConfigured();
  // 로컬에서 실제 저장소를 테스트할 때만 보인다.
  const showDevLogin = process.env.NODE_ENV !== "production" && configured;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-16 pb-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-[40px] leading-none font-extrabold tracking-[-0.04em]">
          샥툰
        </h1>
        <p className="text-body text-ink-muted">사연 한 줄로, 오늘 저녁 첫 인스타툰</p>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-3" aria-hidden>
          <div className="h-[105px] w-[84px] rounded-lg border border-border bg-skeleton" />
          <div className="grid h-[165px] w-[132px] place-items-center rounded-lg border border-border bg-skeleton text-caption text-ink-subtle">
            예시 컷
          </div>
          <div className="h-[105px] w-[84px] rounded-lg border border-border bg-skeleton" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <LoginButtons configured={configured} />
        {showDevLogin && <DevEmailLogin />}
        <p className="text-center text-body-sm text-ink-muted">
          가입하면 <Link href="/terms" className="text-brand-ink underline">이용약관</Link>과{" "}
          <Link href="/privacy" className="text-brand-ink underline">개인정보 처리방침</Link>에 동의하게 돼요.
          <br />
          가입 즉시 8크레딧을 드려요.
        </p>
        {/* AI 기본법 제31조 제1항 — 생성형 AI 기반 서비스라는 사실을 이용 전에 알린다. */}
        <p className="text-center text-caption text-ink-subtle">
          샥툰은 생성형 AI로 콘티·그림·캡션을 만들어요. 만든 이미지에는 AI 생성 표시가 들어가요.
        </p>
      </div>
    </main>
  );
}
