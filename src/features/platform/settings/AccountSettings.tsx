"use client";

import { useState, useTransition } from "react";
import {
  User,
  Coins,
  Plus,
  RotateCcw,
  ShieldAlert,
  AlertCircle,
  Calendar,
  LogOut,
  BarChart2,
  Briefcase,
  Crown,
} from "lucide-react";
import { Badge, Button, Field, Modal, Tabs, type TabItem } from "@/components/ui";
import {
  cancelAccountDeletionAction,
  requestAccountDeletionAction,
  requestRefundAction,
} from "@/features/platform/actions";
import { logoutAction } from "@/features/platform/auth/actions";
import { SnsAnalyticsDashboard } from "../analytics/components/SnsAnalyticsDashboard";
import { MediaKitSection } from "../analytics/components/MediaKitSection";
import { SnsConnectionSection } from "./SnsConnectionSection";
import { SnsComingSoon, SnsDemoBadge } from "../analytics/components/SnsComingSoon";
import { PricingPlanSection } from "../pricing/PricingPlanSection";
import { CreditPurchaseModal } from "../pricing/CreditPurchaseModal";
import { INITIAL_MOCK_SNS_DATA } from "../analytics/mockData";
import type { SnsAnalyticsData } from "../analytics/types";
import { MyActivitySection } from "../activity/MyActivitySection";
import type {
  AccountStatus,
  AttendanceState,
  CreditDetail,
  CreditPolicy,
  PlanTier,
  RefundQuote,
  RefundRequest,
  UserActivityItem,
} from "@/features/platform/data/types";

const PLAN_LABEL: Record<PlanTier, string> = { free: "Free Plan", basic: "Basic Plan", pro: "Pro Plan", max: "Max Plan" };
const REFUND_LABEL: Record<RefundRequest["status"], string> = {
  requested: "처리 중",
  approved: "환불 승인",
  rejected: "반려",
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const day = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

const TABS: TabItem[] = [
  { label: "계정·크레딧", icon: User },
  { label: "SNS 성과", icon: BarChart2 },
  { label: "미디어킷", icon: Briefcase },
  { label: "요금제", icon: Crown },
];

export interface AccountSettingsProps {
  name: string | null;
  plan: PlanTier;
  credit: CreditDetail;
  policy: CreditPolicy;
  quote: RefundQuote;
  refund: RefundRequest | null;
  account: AccountStatus;
  attendance?: AttendanceState;
  attendanceStreak?: number;
  activityLogs?: UserActivityItem[];
  defaultTab?: number;
  initialSnsData?: SnsAnalyticsData;
  /** 실제 인스타 연동(INSTAGRAM_PUBLISH_ENABLED). 꺼져 있으면 undefined, 켜졌는데 미연결이면 null. */
  liveInstagram?: { username: string } | null;
  /** 목 모드인가. 인증 없는 SNS 데모·예시 수치는 목 모드에서만 보여준다. */
  snsDemo?: boolean;
}

/**
 * 마이페이지 — 프로필, 출석 현황, 활동 잔디밭, 크레딧 내역, 환불, 탈퇴.
 */
export function AccountSettings({
  name,
  plan,
  credit,
  policy,
  quote,
  refund,
  account,
  attendance,
  attendanceStreak = 0,
  activityLogs = [],
  defaultTab = 0,
  initialSnsData,
  liveInstagram,
  snsDemo = false,
}: AccountSettingsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [userPlan, setUserPlan] = useState<PlanTier>(plan);
  const [userCredit, setUserCredit] = useState<CreditDetail>(credit);
  const [openCreditPurchase, setOpenCreditPurchase] = useState(false);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [askRefund, setAskRefund] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const [snsData, setSnsData] = useState<SnsAnalyticsData>(initialSnsData ?? INITIAL_MOCK_SNS_DATA);
  const openRefund = refund?.status === "requested";

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>, done?: () => void) {
    setNotice(null);
    start(async () => {
      const r = await action();
      if (r.ok) done?.();
      else setNotice(r.message);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-title-lg font-bold">마이페이지</h1>
        <p className="text-body-sm text-ink-muted">
          내 계정 설정과 크레딧, 인스타그램 연재 성과 분석 및 협찬 미디어킷을 관리할 수 있습니다.
        </p>
      </div>

      <Tabs items={TABS} value={activeTab} onChange={setActiveTab} />

      {activeTab === 0 && (
        <div className="flex flex-col gap-6">
          {notice && (
            <div className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand-tint px-4 py-3 text-body-sm font-semibold text-brand shadow-2xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

      {account.deletionRequestedAt && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger-tint/60 p-5 shadow-2xs">
          <div className="flex flex-1 items-start gap-2.5">
            <ShieldAlert className="size-5 shrink-0 text-danger mt-0.5" />
            <p className="text-body-sm text-danger leading-relaxed">
              탈퇴를 요청했어요. {day(account.purgeAt!)}에 계정과 만든 작품이 모두 지워져요. 그 전에는 되돌릴 수 있어요.
            </p>
          </div>
          <Button variant="secondary" loading={pending} onClick={() => run(cancelAccountDeletionAction)}>
            탈퇴 취소
          </Button>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-tint text-brand">
              <User className="size-4" />
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-title font-semibold">{name ?? "내 계정"}</h2>
              {(attendance?.streak ?? attendanceStreak ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-caption font-bold text-brand">
                  🔥 {attendance?.streak ?? attendanceStreak ?? 0}일차 출석
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Badge tone="brand">{PLAN_LABEL[userPlan]}</Badge>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-2.5 py-1 text-caption font-semibold text-ink-muted hover:text-danger hover:border-danger/40 transition-colors cursor-pointer"
              >
                <LogOut className="size-3.5" />
                <span>로그아웃</span>
              </button>
            </form>
          </div>
        </div>

        {/* 크레딧 현황 및 충전 헤더 바 */}
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-sunken/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-brand" />
            <span className="text-body-sm text-ink font-medium">
              보유 잔량: <strong className="text-title font-bold text-brand tabular-nums">{userCredit.balance} C</strong>
            </span>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setOpenCreditPurchase(true)}
            className="h-8 px-3 text-caption font-semibold gap-1.5"
          >
            <Plus className="size-3.5 stroke-[2.8]" />
            <span>크레딧 충전</span>
          </Button>
        </div>

        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label="무상 크레딧" value={userCredit.byKind.free} />
          <Stat label="구독 크레딧" value={userCredit.byKind.subscription} />
          <Stat label="구매 크레딧" value={userCredit.byKind.purchase} />
        </dl>
        <div className="space-y-1.5 pt-1 text-caption text-ink-muted">
          <p>
            무상 → 구독 → 구매 순으로 차감돼요.
            {userCredit.held > 0 && ` 지금 만드는 중인 컷에 ${userCredit.held}크레딧이 잡혀 있어요.`}
            {userCredit.nextExpiry &&
              ` ${day(userCredit.nextExpiry.at)}에 ${userCredit.nextExpiry.amount}크레딧이 만료돼요.`}
          </p>
          <p className="text-ink-subtle">
            출석하면 하루 {policy.attendanceDaily}크레딧, {policy.attendanceStreakDays}일 연속 출석 시 +{policy.attendanceStreakBonus}크레딧 보너스를 드려요.
          </p>
        </div>
      </section>

      {/* SNS 연재 계정 연동 설정 */}
      <SnsConnectionSection
        account={snsData.account}
        userPlan={userPlan}
        onDataUpdate={setSnsData}
        liveInstagram={liveInstagram}
        snsDemo={snsDemo}
        onNavigateToAnalytics={() => setActiveTab(1)}
        onNavigateToPricing={() => setActiveTab(3)}
      />

      {/* 출석 확인, 연재 기록, 사용 내역 */}
      <MyActivitySection
        attendance={attendance ?? { checkedInToday: false, streak: attendanceStreak ?? 0 }}
        policy={policy}
        initialActivities={activityLogs}
      />

      <section className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
            <RotateCcw className="size-4" />
          </span>
          <h2 className="text-title font-semibold">환불</h2>
        </div>
        {refund && (
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-sunken/40 px-3.5 py-2.5 text-body-sm text-ink-muted">
            <span>최근 신청: {day(refund.createdAt)} · {won(refund.netKrw)}</span>
            <Badge tone={refund.status === "rejected" ? "danger" : "neutral"}>{REFUND_LABEL[refund.status]}</Badge>
          </div>
        )}
        {quote.netKrw > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border/60 bg-surface-sunken/40 p-3.5">
              <p className="text-body text-ink">
                쓰지 않은 유료 크레딧 <strong className="font-semibold text-brand">{quote.credits}개</strong> · {won(quote.grossKrw)}
                {quote.feeKrw > 0 && ` − 공제 ${won(quote.feeKrw)}`} ={" "}
                <strong className="text-title font-bold text-ink">{won(quote.netKrw)}</strong>
              </p>
            </div>
            <p className="text-caption text-ink-muted leading-relaxed">
              결제·환불 수수료로 {Math.round(policy.refundFeeRate * 100)}%를 공제해요. 결제하고 7일 안에 한 번도 안 쓴 결제는 차감하지 않아요.
              앱에서 산 크레딧은 각 스토어에서 환불해요.
            </p>
            <div>
              <Button variant="secondary" disabled={openRefund} onClick={() => setAskRefund(true)}>
                {openRefund ? "환불 처리 중" : "환불 신청"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-body-sm text-ink-muted">
            환불할 유료 크레딧이 없어요. 가입·출석으로 받은 무상 크레딧은 환불되지 않아요.
          </p>
        )}
      </section>

      {!account.deletionRequestedAt && (
        <section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
              <ShieldAlert className="size-4" />
            </span>
            <h2 className="text-title font-semibold">회원 탈퇴</h2>
          </div>
          <p className="text-body-sm text-ink-muted leading-relaxed">
            탈퇴하면 30일 뒤에 계정과 만든 작품이 모두 영구 삭제돼요. 30일 안에는 언제든 되돌릴 수 있어요.
            무상 크레딧은 사라지며, 유료 크레딧은 탈퇴 전 환불 신청을 진행해 주세요.
          </p>
          <div className="pt-1">
            <Button variant="ghost" onClick={() => setAskDelete(true)} className="text-ink-muted hover:text-danger hover:bg-danger-tint/30">
              탈퇴하기
            </Button>
          </div>
        </section>
      )}
    </div>
  )}

  {/* 성과·미디어킷은 목 모드에서만 예시로 보여준다. 배포에서는 실제 연동 출시 전까지 "출시 예정" */}
  {activeTab === 1 &&
    (snsDemo ? (
      <div className="flex flex-col gap-3">
        <DemoNotice />
        <SnsAnalyticsDashboard
          data={snsData}
          onGoToSettings={() => setActiveTab(0)}
          canUseAiFeedback={userPlan === "pro" || userPlan === "max"}
        />
      </div>
    ) : (
      <SnsComingSoon
        title="SNS 성과 분석"
        description="인스타그램을 연결하면 회차별 도달·저장·공유 반응과 AI 독자 반응 피드백을 이곳에서 볼 수 있어요. 준비하고 있어요."
      />
    ))}

  {activeTab === 2 &&
    (snsDemo ? (
      <div className="flex flex-col gap-3">
        <DemoNotice />
        <MediaKitSection mediaKit={snsData.mediaKit} />
      </div>
    ) : (
      <SnsComingSoon
        title="협찬 미디어킷"
        description="실제 인스타그램 성과로 광고주에게 보낼 미디어킷(PDF)을 만드는 기능을 준비하고 있어요."
      />
    ))}

  {activeTab === 3 && (
    <PricingPlanSection
      currentPlan={userPlan}
      creditBalance={credit.balance}
      onPlanChange={setUserPlan}
    />
  )}

      <Modal
        open={askRefund}
        onClose={() => setAskRefund(false)}
        title={`${won(quote.netKrw)}을 환불할까요?`}
        description="신청하면 운영자가 확인한 뒤 결제를 취소해 돌려드려요. 환불한 크레딧은 바로 사라져요."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAskRefund(false)}>
              그대로 둘게요
            </Button>
            <Button
              loading={pending}
              onClick={() => run(() => requestRefundAction(reason.trim() || null), () => setAskRefund(false))}
            >
              환불 신청
            </Button>
          </>
        }
      >
        <Field label="이유(선택)" value={reason} onChange={setReason} maxLength={500} optional />
      </Modal>

      <Modal
        open={askDelete}
        onClose={() => setAskDelete(false)}
        title="정말 탈퇴할까요?"
        description={
          quote.netKrw > 0
            ? `환불받을 수 있는 유료 크레딧(${won(quote.netKrw)})이 있어요. 먼저 환불 신청을 하세요. 30일 뒤에는 모든 작품이 지워져요.`
            : "30일 뒤에 계정과 만든 작품이 모두 지워져요. 그 전에는 이 화면에서 되돌릴 수 있어요."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAskDelete(false)}>
              그대로 둘게요
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => run(requestAccountDeletionAction, () => setAskDelete(false))}
            >
              탈퇴하기
            </Button>
          </>
        }
      />

      <CreditPurchaseModal
        open={openCreditPurchase}
        onClose={() => setOpenCreditPurchase(false)}
        currentPlan={userPlan}
        currentBalance={userCredit.balance}
        onPurchaseSuccess={(added, newTotal) => {
          setUserCredit((prev) => ({
            ...prev,
            balance: newTotal,
            byKind: { ...prev.byKind, purchase: prev.byKind.purchase + added },
          }));
          setNotice(`🎉 ${added} 크레딧 충전이 완료되었습니다! (총 잔량: ${newTotal}C)`);
          setTimeout(() => setNotice(null), 5000);
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface-sunken/40 py-3.5 px-3">
      <dt className="text-caption font-medium text-ink-muted">{label}</dt>
      <dd className="text-title-lg font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** 목 모드 성과·미디어킷 위에 붙인다. 예시 수치를 실제처럼 읽지 않게. */
function DemoNotice() {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-warning-tint px-3 py-2 text-caption text-warning">
      <SnsDemoBadge className="bg-surface-card" />
      목 모드 예시 데이터예요. 실제 인스타그램 계정의 수치가 아니에요.
    </p>
  );
}

