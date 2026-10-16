import type { Metadata } from "next";
import { getRepository, usingMockData } from "@/features/platform/data";
import { AccountSettings } from "@/features/platform/settings/AccountSettings";
import { getSnsAnalyticsAction } from "@/features/platform/analytics/actions";
import { getAccount } from "@/features/platform/instagram/accounts";
import { instagramPublishEnabled } from "@/features/platform/instagram/config";

export const metadata: Metadata = { title: "마이페이지 · 샥툰" };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { tab } = (await searchParams) ?? {};
  const repo = await getRepository();
  const [profile, credit, policy, quote, refund, account, attendance, activityLogs, snsRes] = await Promise.all([
    repo.getProfile(),
    repo.getCreditDetail(),
    repo.getCreditPolicy(),
    repo.getRefundQuote(),
    repo.getMyRefundRequest(),
    repo.getAccountStatus(),
    repo.getAttendance(),
    repo.getActivityLogs(),
    getSnsAnalyticsAction(),
  ]);

  // 실제 인스타 연동은 켜져 있을 때만(INSTAGRAM_PUBLISH_ENABLED). 사업자 등록·앱 심사 전에는 꺼 둔다.
  let liveInstagram: { username: string } | null | undefined;
  if (instagramPublishEnabled()) {
    const userId = await repo.currentUserId();
    const live = userId ? await getAccount(userId) : null;
    liveInstagram = live ? { username: live.username } : null;
  }

  const defaultTab =
    tab === "1" || tab === "analytics"
      ? 1
      : tab === "2" || tab === "mediakit"
      ? 2
      : tab === "3" || tab === "plan" || tab === "pricing" || tab === "membership"
      ? 3
      : 0;

  return (
    <AccountSettings
      name={profile?.displayName ?? null}
      plan={profile?.plan ?? "free"}
      credit={credit}
      policy={policy}
      quote={quote}
      refund={refund}
      account={account}
      attendance={attendance}
      attendanceStreak={attendance.streak}
      activityLogs={activityLogs}
      defaultTab={defaultTab}
      initialSnsData={snsRes.ok ? snsRes.data : undefined}
      liveInstagram={liveInstagram}
      snsDemo={usingMockData()}
    />
  );
}
