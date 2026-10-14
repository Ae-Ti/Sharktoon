import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, CreditPill } from "@/components/ui";
import { getRepository, usingMockData } from "@/features/platform/data";
import { SideNav } from "@/features/platform/shell/SideNav";
import { getSession } from "@/features/platform/auth/session";
import { logoutAction } from "@/features/platform/auth/actions";
import { LogOut } from "lucide-react";

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
    <div className="flex min-h-dvh flex-col">
      {usingMockData() && (
        <p className="bg-warning-tint px-4 py-1.5 text-center text-caption text-warning">
          Supabase 미연결 · 목 데이터로 보고 있어요
        </p>
      )}

      <div className="flex flex-1 flex-col md:flex-row">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface-card px-4 py-3 md:w-56 md:flex-col md:items-stretch md:gap-5 md:border-r md:border-b-0 md:px-3 md:py-5">
          <Link href="/home" className="px-2.5 text-title-lg font-extrabold tracking-[-0.03em] text-ink">
            샥툰
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
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
