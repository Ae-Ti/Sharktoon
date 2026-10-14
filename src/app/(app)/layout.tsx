import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, CreditPill } from "@/components/ui";
import { getRepository, usingMockData } from "@/features/platform/data";
import { SideNav } from "@/features/platform/shell/SideNav";
import { MobileNav } from "@/features/platform/shell/MobileNav";
import { getSession } from "@/features/platform/auth/session";
import { logoutAction } from "@/features/platform/auth/actions";
import { LogOut, User } from "lucide-react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const repo = await getRepository();
  const [credit, series, profile] = await Promise.all([
    repo.getCredit(),
    repo.listSeries(),
    repo.getProfile(),
  ]);
  const seriesHref = "/series";
  const isAdmin = Boolean(session.isAdmin);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-page">
      {usingMockData() && (
        <p className="bg-warning-tint px-4 py-1.5 text-center text-caption text-warning">
          Supabase 미연결 · 목 데이터로 보고 있어요
        </p>
      )}

      {/* 모바일 전용 상단 헤더 (md 미만) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/80 bg-surface-card/95 px-4 py-3 backdrop-blur-md md:hidden">
        <Link href="/home" className="text-title-lg font-extrabold tracking-[-0.03em] text-ink">
          샥<span className="text-brand">툰</span>
        </Link>
        <div className="flex items-center gap-2">
          <CreditPill balance={credit.balance} delta={credit.delta} />
          <form action={logoutAction}>
            <button
              type="submit"
              title="로그아웃"
              className="flex size-8 items-center justify-center rounded-lg border border-border/80 bg-surface-card text-ink-muted hover:text-danger hover:border-danger/40 transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        {/* 데스크톱 전용 좌측 사이드바 (md 이상) */}
        <aside className="hidden md:flex md:w-56 md:flex-col md:items-stretch md:gap-5 md:border-r md:border-border/80 md:bg-surface-card md:px-3 md:py-5">
          <Link href="/home" className="px-2.5 text-title-lg font-extrabold tracking-[-0.03em] text-ink">
            샥<span className="text-brand">툰</span>
          </Link>
          <SideNav seriesHref={seriesHref} isAdmin={isAdmin} />

          {/* 현재 로그인 세션 사용자 정보 & 로그아웃 & 크레딧 */}
          <div className="flex flex-col gap-2.5 border-t border-border/80 pt-3 md:mt-auto md:px-1.5">
            <div className="flex items-center justify-between gap-1">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-label font-bold text-ink">
                  {session.displayName || "회원"}
                </span>
                <span className="truncate text-[11px] text-ink-muted">
                  {session.email}
                </span>
              </div>
              <Badge tone={isAdmin ? "brand" : "neutral"}>
                {isAdmin ? "관리자" : "일반"}
              </Badge>
            </div>

            <CreditPill balance={credit.balance} delta={credit.delta} />

            <form action={logoutAction} className="mt-0.5">
              <button
                type="submit"
                className="flex items-center gap-1.5 cursor-pointer text-[12px] text-ink-subtle hover:text-danger hover:underline transition-colors"
              >
                <LogOut className="size-3.5" />
                <span>로그아웃</span>
              </button>
            </form>
          </div>
        </aside>

        {/* 본문 컨텐츠 (모바일 하단 내비게이션 바 높이 pb-24 확보) */}
        <main className="flex-1 px-4 py-5 pb-24 md:px-8 md:py-6 md:pb-8">{children}</main>
      </div>

      {/* 모바일 전용 하단 탭 내비게이션 바 (md 미만) */}
      <MobileNav seriesHref={seriesHref} />
    </div>
  );
}
