"use client";

import { useState, useTransition } from "react";
import {
  RefreshCw,
  Unlink,
  BarChart2,
  CheckCircle2,
  Sparkles,
  Link as LinkIcon,
  Lock,
} from "lucide-react";
import { Badge, Button, Modal, Field } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  connectInstagramAction,
  disconnectInstagramAction,
  refreshSnsAnalyticsAction,
} from "../analytics/actions";
import type { SnsAccountInfo, SnsAnalyticsData } from "../analytics/types";
import type { PlanTier } from "../data/types";
import { disconnectInstagramAccountAction } from "../instagram/actions";
import { SnsComingSoon, SnsDemoBadge } from "../analytics/components/SnsComingSoon";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}만`;
  }
  return num.toLocaleString("ko-KR");
}

function timeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    return new Date(isoString).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  } catch {
    return "최근";
  }
}

export interface SnsConnectionSectionProps {
  account: SnsAccountInfo;
  userPlan?: PlanTier;
  onDataUpdate: (data: SnsAnalyticsData) => void;
  onNavigateToAnalytics?: () => void;
  onNavigateToPricing?: () => void;
  /** 실제 인스타 연동(시험용). 꺼져 있으면 undefined, 켜졌는데 미연결이면 null. */
  liveInstagram?: { username: string } | null;
  /** 목 모드 데모(아이디 입력·예시 수치)를 보여줄지. 배포에서는 false — "출시 예정". */
  snsDemo?: boolean;
}

export function SnsConnectionSection({
  account,
  userPlan = "free",
  onDataUpdate,
  onNavigateToAnalytics,
  onNavigateToPricing,
  liveInstagram,
  snsDemo = false,
}: SnsConnectionSectionProps) {
  const [pending, start] = useTransition();
  const [openModal, setOpenModal] = useState(false);
  const [inputUsername, setInputUsername] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const handleConnect = () => {
    start(async () => {
      const res = await connectInstagramAction(inputUsername);
      if (res.ok) {
        onDataUpdate(res.data);
        setOpenModal(false);
        setNotice("인스타그램 계정이 성공적으로 연동되었어요!");
        setTimeout(() => setNotice(null), 3500);
      } else {
        setNotice(res.message);
      }
    });
  };

  const handleDisconnect = () => {
    if (!confirm("인스타그램 계정 연동을 해제하시겠어요?")) return;
    start(async () => {
      const res = await disconnectInstagramAction();
      if (res.ok) {
        onDataUpdate({
          account: { ...account, connected: false },
          overview: {
            totalReach: 0,
            totalReachDelta: 0,
            totalViews: 0,
            avgSaves: 0,
            avgSavesDelta: 0,
            avgShares: 0,
            avgSharesDelta: 0,
            engagementRate: 0,
            newFollowers: 0,
          },
          trends: [],
          topEpisodes: [],
          recommendation: {
            highlight: "계정을 연동하면 실시간 독자 반응 피드백이 생성됩니다.",
            recommendedTheme: "일상 공감",
            recommendedHook: "주인공의 표정 클로즈업",
            bestFormat: "4~6컷 분량이 가장 효과적입니다.",
          },
          mediaKit: {
            creatorName: "작가",
            channelName: "sharktoon_daily",
            category: "일상/직장툰",
            bio: "인스타그램 연동 후 미디어킷이 자동으로 완성됩니다.",
            contactEmail: "",
            standardRate: "협의",
            avgReachPerEpisode: 0,
            avgSavesPerEpisode: 0,
            primaryAudience: "연동 대기 중",
          },
        });
        setNotice("인스타그램 연동이 해제되었어요.");
        setTimeout(() => setNotice(null), 3000);
      } else {
        setNotice(res.message);
      }
    });
  };

  const handleRefresh = () => {
    start(async () => {
      const res = await refreshSnsAnalyticsAction();
      if (res.ok) {
        onDataUpdate(res.data);
        setNotice("성과 데이터를 최신으로 동기화했어요.");
        setTimeout(() => setNotice(null), 3000);
      } else {
        setNotice(res.message);
      }
    });
  };

  const handleLiveDisconnect = () => {
    if (!confirm("인스타그램 연결을 해제할까요? 예약해 둔 발행은 취소돼요.")) return;
    start(async () => {
      const res = await disconnectInstagramAccountAction();
      setNotice(res.ok ? "인스타그램 연결을 해제했어요." : res.message);
      if (res.ok) window.location.reload();
    });
  };

  const liveBlock = (
    <>
      {/* 실제 연동(Instagram Login). 앱 심사 전에는 Meta 앱에 역할로 등록된 계정만 연결된다 */}
      {liveInstagram !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand-tint/40 px-3.5 py-2.5 text-caption">
          <span className="font-semibold text-ink">
            {liveInstagram ? `실제 연동: @${liveInstagram.username}` : "실제 인스타그램 연동(시험)"}
          </span>
          {liveInstagram ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={handleLiveDisconnect} className="text-ink-muted hover:text-danger">
              연결 해제
            </Button>
          ) : (
            <a href="/api/instagram/connect" className="font-bold text-brand hover:underline">
              인스타그램으로 로그인 ↗
            </a>
          )}
        </div>
      )}
    </>
  );

  // 배포(실 저장소): 아이디만 받는 데모 연동은 인증이 없어 쓰지 않는다. 기능 출시 전까지 "출시 예정".
  if (!snsDemo) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
        {notice && <p className="text-caption font-semibold text-brand">{notice}</p>}
        {liveBlock}
        {liveInstagram === undefined && (
          <SnsComingSoon
            title="인스타그램 연동"
            description="인스타그램 로그인으로 본인 계정을 연결해 회차별 도달·저장 반응을 모아 보고, 원클릭 발행·자동 예약까지 쓰는 기능을 준비하고 있어요."
            className="border-0 bg-transparent p-0"
          />
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
      {liveBlock}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-2xs">
            <InstagramIcon className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-title font-semibold">SNS 연재 계정 연동</h2>
              {account.connected ? (
                <>
                  <Badge tone="brand" className="text-[11px] font-bold">
                    연동됨
                  </Badge>
                  <SnsDemoBadge />
                </>
              ) : (
                <Badge tone="neutral" className="text-[11px]">
                  미연동
                </Badge>
              )}
            </div>
            <p className="text-caption text-ink-muted">
              인스타그램 크리에이터 계정을 연동하여 연재 성과 분석 및 협찬 미디어킷을 자동으로 관리하세요.
            </p>
          </div>
        </div>

      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand-tint px-3.5 py-2.5 text-body-sm font-semibold text-brand shadow-2xs">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {account.connected ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-sunken/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-2xs">
                <InstagramIcon className="size-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-body font-bold text-ink">@{account.username}</span>
                  <span className="rounded-md bg-brand-tint px-1.5 py-0.5 text-[10px] font-bold text-brand">
                    {account.accountType}
                  </span>
                </div>
                <span className="text-caption text-ink-muted">
                  {account.displayName} · 팔로워 {formatNumber(account.followersCount)}명 · 최근 동기화:{" "}
                  {timeAgo(account.lastSyncedAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={pending}
                onClick={handleRefresh}
                className="gap-1.5 font-semibold text-caption"
                title="인스타그램 최신 성과 동기화"
              >
                <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
                <span>데이터 동기화</span>
              </Button>

              {onNavigateToAnalytics && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onNavigateToAnalytics}
                  className="gap-1.5 font-semibold text-caption text-brand hover:text-brand-hover"
                  title="성과 분석 대시보드로 이동"
                >
                  <BarChart2 className="size-3.5" />
                  <span>성과 분석 보기</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                className="gap-1 text-ink-muted hover:text-danger text-caption"
                title="인스타그램 연동 해제"
              >
                <Unlink className="size-3.5" />
                <span>연동 해제</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-between gap-3 rounded-lg border border-dashed border-border/80 bg-surface-sunken/20 p-5 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <span className="hidden size-10 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle sm:flex">
              <LinkIcon className="size-5" />
            </span>
            <div className="flex flex-col">
              <span className="text-body-sm font-semibold text-ink">
                아직 연동된 인스타그램 계정이 없습니다.
              </span>
              <span className="text-caption text-ink-muted">
                계정을 연동하면 연재 회차의 도달수, 저장수, 독자 반응이 성과 분석 탭에 자동 표시됩니다.
              </span>
            </div>
          </div>
          {/* 연결 버튼은 여기 하나만 둔다 */}
          <Button variant="primary" size="sm" onClick={() => setOpenModal(true)} className="shrink-0 gap-1.5 font-semibold">
            <InstagramIcon className="size-3.5" />
            <span>계정 연동하기</span>
          </Button>
        </div>
      )}

      {/* 요금제 비교는 요금제 탭에만 둔다. 여기서는 무료에게 한 줄 안내만 */}
      {userPlan === "free" && onNavigateToPricing && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-pink-500/10 border border-pink-500/20 px-3.5 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-pink-900">
            <Lock className="size-3 shrink-0 text-pink-500" />
            AI 독자 반응 피드백은 Pro 플랜부터 쓸 수 있어요. 원클릭 발행 · 자동 예약은 출시 예정이에요.
          </span>
          <Button
            size="sm"
            variant="primary"
            onClick={onNavigateToPricing}
            className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-bold text-xs h-7 px-3 shrink-0"
          >
            Pro 플랜 알아보기 ↗
          </Button>
        </div>
      )}

      {/* 인스타그램 연동 모달 */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="인스타그램 크리에이터 계정 연동"
        description="인스타그램 비즈니스/크리에이터 계정 아이디를 입력해주세요. Meta Graph API를 통해 최근 회차의 성과 데이터를 안전하게 연동합니다."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenModal(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={handleConnect}
              className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 font-bold text-white"
            >
              연동 시작하기
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="인스타그램 아이디 (@ 제외 또는 포함)"
            value={inputUsername}
            onChange={setInputUsername}
            placeholder="예: sharktoon_daily"
          />
          <div className="flex items-start gap-2 rounded-xl bg-surface-sunken/60 p-3 text-caption text-ink-muted">
            <Sparkles className="size-4 shrink-0 text-amber-500 mt-0.5" />
            <p>
              계정을 연동하면 <strong>독자 저장률 분석</strong>, <strong>추천 테마 피드백</strong>, 그리고 협찬사를 위한 <strong>실시간 미디어킷</strong>이 자동으로 활성화됩니다.
            </p>
          </div>
        </div>
      </Modal>
    </section>
  );
}

