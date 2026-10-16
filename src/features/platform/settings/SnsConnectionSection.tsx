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
  Crown,
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
}

export function SnsConnectionSection({
  account,
  userPlan = "free",
  onDataUpdate,
  onNavigateToAnalytics,
  onNavigateToPricing,
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
            totalImpressions: 0,
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

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-2xs">
            <InstagramIcon className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-title font-semibold">SNS 연재 계정 연동</h2>
              {account.connected ? (
                <Badge tone="brand" className="text-[11px] font-bold">
                  연동됨
                </Badge>
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

        {!account.connected && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setOpenModal(true)}
            className="shrink-0 gap-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 font-bold text-white shadow-xs"
          >
            <InstagramIcon className="size-3.5" />
            <span>연동하기</span>
          </Button>
        )}
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOpenModal(true)}
            className="shrink-0 gap-1.5 font-semibold text-ink"
          >
            <InstagramIcon className="size-3.5 text-pink-600" />
            <span>계정 등록</span>
          </Button>
        </div>
      )}

      {/* 방안 B 정책: 플랜별 인스타그램 연동 혜택 & Free 업그레이드 유도 */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface-sunken/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" />
            <span className="text-caption font-bold text-ink">플랜별 인스타그램 연동 기능 안내</span>
          </div>
          <Badge tone={userPlan === "free" ? "neutral" : "brand"} className="text-[10px]">
            현재: {userPlan === "free" ? "Free 무료 플랜" : userPlan === "pro" ? "Pro 플랜" : "Max 플랜"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-caption">
          {/* Free 플랜 */}
          <div className={cn(
            "flex flex-col gap-1.5 rounded-lg border p-3 bg-surface-card",
            userPlan === "free" ? "border-brand/40 ring-1 ring-brand/30" : "border-border/60 opacity-80"
          )}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink">Free (무료 체험)</span>
              {userPlan === "free" && <Badge tone="brand" className="text-[9px]">내 플랜</Badge>}
            </div>
            <ul className="text-[11px] text-ink-muted space-y-1">
              <li className="flex items-center gap-1.5 text-ink">
                <span className="text-brand">✓</span> 기본 성과(도달/저장) 요약 조회
              </li>
              <li className="flex items-center gap-1.5 text-ink">
                <span className="text-brand">✓</span> 컷 완성본 수동 다운로드 후 외부 게시
              </li>
              <li className="flex items-center gap-1.5 text-ink-subtle">
                <Lock className="size-2.5 text-ink-subtle shrink-0" /> 1-Click 피드 즉시 발행 (미지원)
              </li>
              <li className="flex items-center gap-1.5 text-ink-subtle">
                <Lock className="size-2.5 text-ink-subtle shrink-0" /> 자동 예약 스케줄러 (미지원)
              </li>
            </ul>
          </div>

          {/* Pro 플랜 */}
          <div className={cn(
            "flex flex-col gap-1.5 rounded-lg border p-3 bg-surface-card",
            userPlan === "pro" ? "border-brand/40 ring-1 ring-brand/30" : "border-pink-500/30 bg-pink-500/[0.02]"
          )}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink flex items-center gap-1">
                Pro (프로 작가)
                <span className="text-[10px] text-pink-600 font-semibold">추천 ✨</span>
              </span>
              {userPlan === "pro" && <Badge tone="brand" className="text-[9px]">내 플랜</Badge>}
            </div>
            <ul className="text-[11px] text-ink-muted space-y-1">
              <li className="flex items-center gap-1.5 text-ink font-medium">
                <span className="text-pink-600">✓</span> <strong>1-Click 피드 즉시 발행</strong>
              </li>
              <li className="flex items-center gap-1.5 text-ink font-medium">
                <span className="text-pink-600">✓</span> <strong>인스타그램 자동 예약 발행</strong>
              </li>
              <li className="flex items-center gap-1.5 text-ink">
                <span className="text-pink-600">✓</span> 실시간 독자 반응 AI 피드백
              </li>
              <li className="flex items-center gap-1.5 text-ink">
                <span className="text-pink-600">✓</span> 협찬 미디어킷 (웹 링크 & PDF)
              </li>
            </ul>
          </div>

          {/* Max 플랜 */}
          <div className={cn(
            "flex flex-col gap-1.5 rounded-lg border p-3 bg-surface-card",
            userPlan === "max" ? "border-brand/40 ring-1 ring-brand/30" : "border-border/60 opacity-80"
          )}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink flex items-center gap-1">
                Max (맥스 전업)
                <Crown className="size-3 text-amber-500" />
              </span>
              {userPlan === "max" && <Badge tone="brand" className="text-[9px]">내 플랜</Badge>}
            </div>
            <ul className="text-[11px] text-ink-muted space-y-1">
              <li className="flex items-center gap-1.5 text-ink font-medium">
                <span className="text-amber-600">✓</span> <strong>Pro 모든 혜택 포함 (즉시/예약/미디어킷)</strong>
              </li>
              <li className="flex items-center gap-1.5 text-ink">
                <span className="text-amber-600">✓</span> 나만의 그림체 학습 (Custom LoRA)
              </li>
              <li className="flex items-center gap-1.5 text-ink">
                <span className="text-amber-600">✓</span> 4K Ultra HD & Turbo 전용 GPU 큐
              </li>
              <li className="flex items-center gap-1.5 text-ink">
                <span className="text-amber-600">✓</span> 광고주 협찬 매칭 풀 우선 노출
              </li>
            </ul>
          </div>
        </div>

        {userPlan === "free" && onNavigateToPricing && (
          <div className="flex items-center justify-between rounded-lg bg-pink-500/10 border border-pink-500/20 px-3.5 py-2">
            <span className="text-[11px] font-semibold text-pink-900">
              ⚡ 1-Click 즉시 발행과 자동 예약 발행으로 연재를 자동화하고 싶으신가요?
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={onNavigateToPricing}
              className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-bold text-xs h-7 px-3 shrink-0"
            >
              Pro 플랜 업그레이드 ↗
            </Button>
          </div>
        )}
      </div>

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

