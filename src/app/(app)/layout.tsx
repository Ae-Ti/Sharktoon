import Link from "next/link";
import type { ReactNode } from "react";
import { CreditPill } from "@/components/ui";
import { getRepository, usingMockData } from "@/features/platform/data";
import { SideNav } from "@/features/platform/shell/SideNav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const repo = await getRepository();
  const [credit, series] = await Promise.all([
    repo.getCredit(),
    repo.listSeries(),
  ]);
  const seriesHref = series[0] ? `/series/${series[0].id}` : null;

  return (
    <div className="flex min-h-dvh flex-col">
      {usingMockData() && (
        <p className="bg-warning-tint px-4 py-1.5 text-center text-caption text-warning">
          Supabase 미연결 · 목 데이터로 보고 있어요
        </p>
      )}

      <div className="flex flex-1 flex-col md:flex-row">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface-card px-4 py-3 md:w-55 md:flex-col md:items-stretch md:gap-6 md:border-r md:border-b-0 md:px-3 md:py-5">
          <Link href="/home" className="px-2.5 text-title-lg font-extrabold tracking-[-0.03em] text-ink">
            샥툰
          </Link>
          <SideNav seriesHref={seriesHref} />
          <div className="md:mt-auto md:px-2">
            <CreditPill balance={credit.balance} delta={credit.delta} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
