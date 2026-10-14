import type { Metadata } from "next";
import { TrendingUp, AlertTriangle, Coins, Filter, Clock } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { getRepository } from "@/features/platform/data";
import { BillingAdmin } from "@/features/platform/admin/BillingAdmin";

export const metadata: Metadata = { title: "운영 · 샥툰" };

function percent(n: number) {
  return `${Math.round(n * 1000) / 10}%`;
}

export default async function Page() {
  const repo = await getRepository();
  const overview = await repo.getAdminOverview();

  if (!overview) {
    return (
      <EmptyState
        title="운영자만 볼 수 있어요"
        description="계정에 운영자 권한이 없으면 집계가 열리지 않아요."
      />
    );
  }

  const { funnel, generation, credit, recentRefunds } = overview;
  const refundRequests = await repo.listRefundRequests();
  const top = funnel[0]?.users ?? 0;
  const published = funnel[funnel.length - 1]?.users ?? 0;
  // 클로즈드 베타 출시 조건이 이 수치다.
  const completion = top === 0 ? 0 : published / top;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title-lg font-bold">운영 대시보드</h1>
        <p className="text-body-sm text-ink-muted">
          핵심 지표, 퍼널 전환율, 크레딧 소모 및 환불 요청을 모니터링합니다.
        </p>
      </div>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <article className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs transition-all hover:border-border-control">
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-medium text-ink-muted">첫 게시 완주율</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand-tint text-brand">
              <TrendingUp className="size-4" />
            </span>
          </div>
          <span className="text-[32px] leading-10 font-bold tabular-nums text-ink">
            {percent(completion)}
          </span>
          <span className="text-caption text-ink-muted">
            목표 40% · 가입 {top}명 중 {published}명 완주
          </span>
        </article>

        <article className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs transition-all hover:border-border-control">
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-medium text-ink-muted">생성 실패율</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <AlertTriangle className="size-4" />
            </span>
          </div>
          <span className="text-[32px] leading-10 font-bold tabular-nums text-ink">
            {percent(generation.failureRate)}
          </span>
          <span className="text-caption text-ink-muted">
            목표 3% 이하 · 요청 {generation.holds}건 중 {generation.refunded}건 환불
          </span>
        </article>

        <article className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs transition-all hover:border-border-control">
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-medium text-ink-muted">크레딧 현황</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand-tint text-brand">
              <Coins className="size-4" />
            </span>
          </div>
          <span className="text-[32px] leading-10 font-bold tabular-nums text-ink">
            {credit.spent}
          </span>
          <span className="text-caption text-ink-muted">
            소모 · 지급 {credit.granted} · 환불 {credit.refunded}
          </span>
        </article>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-ink-muted" />
          <h2 className="text-title font-semibold">온보딩 퍼널</h2>
        </div>
        <ul className="flex flex-col gap-2">
          {funnel.map((f, i) => {
            const ratio = top === 0 ? 0 : f.users / top;
            const prev = i === 0 ? null : funnel[i - 1].users;
            const dropped = prev == null ? 0 : prev - f.users;
            return (
              <li
                key={f.step}
                className="flex items-center gap-4 rounded-lg border border-border/60 bg-surface-sunken/40 px-4 py-3"
              >
                <span className="w-24 shrink-0 text-label font-semibold text-ink">{f.step}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className="block h-full rounded-full bg-brand transition-all"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-label font-medium tabular-nums text-ink">
                  {f.users}명
                </span>
                <span className="w-20 shrink-0 text-right text-caption tabular-nums text-danger font-medium">
                  {dropped > 0 ? `-${dropped}명` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-ink-muted" />
            <h2 className="text-title font-semibold">최근 크레딧 환불</h2>
          </div>
          <Badge tone={recentRefunds.length > 0 ? "warning" : "neutral"}>
            {recentRefunds.length}건
          </Badge>
        </div>

        {recentRefunds.length === 0 ? (
          <p className="text-body-sm text-ink-muted">환불된 생성이 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-md border-collapse text-body-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-caption text-ink-muted">
                  <th className="py-2.5 font-medium">시각</th>
                  <th className="py-2.5 font-medium">사용자</th>
                  <th className="py-2.5 text-right font-medium">환불</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {recentRefunds.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-sunken/30 transition-colors">
                    <td className="py-2.5 tabular-nums text-ink-muted">
                      {new Date(r.createdAt).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 font-mono text-caption text-ink">{r.userId}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-brand">
                      +{r.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BillingAdmin requests={refundRequests} />
    </div>
  );
}
