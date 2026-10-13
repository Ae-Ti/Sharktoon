import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui";
import { getSession } from "@/features/platform/auth/session";
import { Sparkles, ArrowRight } from "lucide-react";

export default async function Page() {
  const session = await getSession();
  if (session) {
    redirect("/home");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 pt-16 pb-8">
      <div className="flex flex-col gap-2.5">
        <div className="inline-flex items-center gap-1.5 w-fit rounded-full bg-brand-tint px-3 py-1 text-caption font-semibold text-brand">
          <Sparkles className="size-3.5" />
          <span>AI 인스타툰 크리에이터</span>
        </div>
        <h1 className="text-[44px] leading-none font-extrabold tracking-[-0.04em] text-ink">
          샥<span className="text-brand">툰</span>
        </h1>
        <p className="text-body font-medium text-ink-muted">
          사연 한 줄로, 오늘 저녁 첫 인스타툰을 발행해 보세요.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center py-6">
        <div className="flex items-center gap-3" aria-hidden>
          <div className="h-[120px] w-[96px] rounded-xl border border-border/80 bg-surface-sunken shadow-2xs rotate-[-4deg] opacity-70" />
          <div className="flex h-[184px] w-[148px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-brand/20 bg-surface-card p-4 shadow-lg ring-4 ring-brand/5">
            <div className="grid size-12 place-items-center rounded-xl bg-brand-tint text-brand">
              <Sparkles className="size-6" />
            </div>
            <span className="text-center text-xs font-bold text-ink">
              나만의 4컷 만화
            </span>
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-center text-[10px] font-semibold text-brand">
              AI 자동 생성
            </span>
          </div>
          <div className="h-[120px] w-[96px] rounded-xl border border-border/80 bg-surface-sunken shadow-2xs rotate-[4deg] opacity-70" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <ButtonLink href="/login?mode=signup" size="lg" variant="primary" block className="group flex items-center justify-center gap-1.5 shadow-sm">
          <span>지금 무료로 시작하기</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </ButtonLink>
        <ButtonLink href="/login?mode=signin" size="lg" variant="secondary" block>
          이미 계정이 있어요 (로그인)
        </ButtonLink>

        <p className="mt-2 text-center text-body-sm text-ink-muted">
          가입 즉시 8크레딧을 드려요.
          <br />
          <Link href="/terms" className="text-brand underline">이용약관</Link>과{" "}
          <Link href="/privacy" className="text-brand underline">개인정보 처리방침</Link>
        </p>
        <p className="text-center text-caption text-ink-subtle">
          샥툰은 생성형 AI로 콘티·그림·캡션을 만들어요.
        </p>
      </div>
    </main>
  );
}
