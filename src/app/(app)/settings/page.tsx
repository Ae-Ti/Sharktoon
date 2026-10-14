import type { Metadata } from "next";
import { getRepository } from "@/features/platform/data";
import { AccountSettings } from "@/features/platform/settings/AccountSettings";

export const metadata: Metadata = { title: "마이페이지 · 샥툰" };

export default async function Page() {
  const repo = await getRepository();
  const [profile, credit, policy, quote, refund, account, attendance] = await Promise.all([
    repo.getProfile(),
    repo.getCreditDetail(),
    repo.getCreditPolicy(),
    repo.getRefundQuote(),
    repo.getMyRefundRequest(),
    repo.getAccountStatus(),
    repo.getAttendance(),
  ]);

  return (
    <AccountSettings
      name={profile?.displayName ?? null}
      plan={profile?.plan ?? "free"}
      credit={credit}
      policy={policy}
      quote={quote}
      refund={refund}
      account={account}
      attendanceStreak={attendance.streak}
    />
  );
}
