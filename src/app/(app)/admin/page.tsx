import type { Metadata } from "next";
import { Badge, EmptyState } from "@/components/ui";
import { getRepository } from "@/features/platform/data";

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
  const top = funnel[0]?.users ?? 0;
  const published = funnel[funnel.length - 1]?.users ?? 0;
  // 클로즈드 베타 출시 조건이 이 수치다.
  const completion = top === 0 ? 0 : published / top;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title-lg font-bold">운영</h1>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <article className="flex flex-col gap-1 rounded-lg border border-border bg-surface-card p-5">
          <span className="text-body-sm text-ink-muted">첫 게시 완주율</span>
          <span className="text-[32px] leading-10 font-bold tabular-nums">
            {percent(completion)}
          </span>
          <span className="text-caption text-ink-muted">
            목표 40% · 가입 {top}명 중 {published}명
          </span>
        </article>

        <article className="flex flex-col gap-1 rounded-lg border border-border bg-surface-card p-5">
          <span className="text-body-sm text-ink-muted">생성 실패율</span>
          <span className="text-[32px] leading-10 font-bold tabular-nums">
            {percent(generation.failureRate)}
          </span>
          <span className="text-caption text-ink-muted">
            목표 3% 이하 · 요청 {generation.holds}건 중 {generation.refunded}건 환불
          </span>
        </article>

        <article className="flex flex-col gap-1 rounded-lg border border-border bg-surface-card p-5">
          <span className="text-body-sm text-ink-muted">크레딧</span>
          <span className="text-[32px] leading-10 font-bold tabular-nums">
            {credit.spent}
          </span>
          <span className="text-caption text-ink-muted">
            소모 · 지급 {credit.granted} · 환불 {credit.refunded}
          </span>
        </article>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-title font-semibold">온보딩 깔때기</h2>
        <ul className="flex flex-col gap-2">
          {funnel.map((f, i) => {
            const ratio = top === 0 ? 0 : f.users / top;
            const prev = i === 0 ? null : funnel[i - 1].users;
            const dropped = prev == null ? 0 : prev - f.users;
            return (
              <li
                key={f.step}
                className="flex items-center gap-4 rounded-md border border-border bg-surface-card px-4 py-3"
              >
                <span className="w-24 shrink-0 text-label font-semibold">{f.step}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-label tabular-nums">
                  {f.users}명
                </span>
                <span className="w-20 shrink-0 text-right text-caption tabular-nums text-ink-muted">
                  {dropped > 0 ? `-${dropped}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-title font-semibold">최근 크레딧 환불</h2>
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
                <tr className="border-b border-border text-left text-caption text-ink-muted">
                  <th className="py-2 font-medium">시각</th>
                  <th className="py-2 font-medium">사용자</th>
                  <th className="py-2 text-right font-medium">환불</th>
                </tr>
              </thead>
              <tbody>
                {recentRefunds.map((r) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="py-2 tabular-nums text-ink-muted">
                      {new Date(r.createdAt).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2 font-mono text-caption">{r.userId}</td>
                    <td className="py-2 text-right tabular-nums text-accent-ink">
                      +{r.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
