"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Sparkles,
  RefreshCw,
  Unlink,
  ExternalLink,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  Lock,
} from "lucide-react";
import { Badge, Button, Modal, Field } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  connectInstagramAction,
  disconnectInstagramAction,
  refreshSnsAnalyticsAction,
} from "@/features/platform/analytics/actions";
import type { SnsAnalyticsData } from "@/features/platform/analytics/types";
import {
  getSeriesSnsMetrics,
  formatCompactNumber,
} from "@/features/platform/analytics/seriesAnalytics";
import type { EpisodeStatus, SeriesRule, PlanTier } from "@/features/platform/data/types";

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

export interface InstagramIntegrationCardProps {
  series: {
    id: string;
    title: string;
    rule?: SeriesRule;
  };
  episodes: {
    id: string;
    number: number;
    title: string | null;
    status: EpisodeStatus;
  }[];
  initialSnsData: SnsAnalyticsData;
  userPlan?: PlanTier;
  onSnsDataUpdate?: (newData: SnsAnalyticsData) => void;
}

export function InstagramIntegrationCard({
  series,
  episodes,
  initialSnsData,
  userPlan = "free",
  onSnsDataUpdate,
}: InstagramIntegrationCardProps) {
  const isProOrAbove = userPlan === "pro" || userPlan === "max";
  const [snsData, setSnsData] = useState<SnsAnalyticsData>(initialSnsData);
  const [openModal, setOpenModal] = useState(false);
  const [inputUsername, setInputUsername] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const summary = getSeriesSnsMetrics(series, episodes, snsData);

  function handleConnect() {
    start(async () => {
      const res = await connectInstagramAction(inputUsername);
      if (res.ok) {
        setSnsData(res.data);
        onSnsDataUpdate?.(res.data);
        setOpenModal(false);
        setNotice("인스타그램 계정이 연동되었습니다!");
        setTimeout(() => setNotice(null), 3000);
      } else {
        setNotice(res.message);
      }
    });
  }

  function handleDisconnect() {
    if (!confirm("인스타그램 계정 연동을 해제하시겠어요? 마이페이지에서도 함께 해제됩니다.")) return;
    start(async () => {
      const res = await disconnectInstagramAction();
      if (res.ok) {
        const next: SnsAnalyticsData = {
          ...snsData,
          account: { ...snsData.account, connected: false },
        };
        setSnsData(next);
        onSnsDataUpdate?.(next);
        setNotice("연동이 해제되었습니다.");
        setTimeout(() => setNotice(null), 3000);
      } else {
        setNotice(res.message);
      }
    });
  }

  function handleRefresh() {
    start(async () => {
      const res = await refreshSnsAnalyticsAction();
      if (res.ok) {
        setSnsData(res.data);
        onSnsDataUpdate?.(res.data);
        setNotice("최신 성과 데이터가 동기화되었습니다.");
        setTimeout(() => setNotice(null), 2500);
      } else {
        setNotice(res.message);
      }
    });
  }

  if (summary.connected) {
    return (
      <div className="flex w-full shrink-0 flex-col gap-3.5 rounded-xl border border-pink-500/30 bg-gradient-to-b from-pink-500/5 to-transparent p-5 lg:w-88 shadow-2xs">
        {notice && (
          <div className="flex items-center gap-2 rounded-lg bg-brand-tint px-3 py-1.5 text-caption font-semibold text-brand">
            <CheckCircle2 className="size-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-2xs">
              <InstagramIcon className="size-4" />
            </div>
            <span className="text-body font-bold text-ink">인스타그램 연동됨</span>
          </div>
          <Badge tone="brand" className="text-[10px]">
            연결 활성
          </Badge>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-card p-3 shadow-2xs">
          <div className="flex flex-col">
            <span className="text-body-sm font-bold text-ink">@{summary.username}</span>
            <span className="text-[11px] text-ink-muted">크리에이터 계정 · 실시간 수집 중</span>
          </div>
          <a
            href={`https://instagram.com/${summary.username}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
          >
            <span>프로필</span>
            <ExternalLink className="size-3" />
          </a>
        </div>

        {/* 시리즈 맞춤형 성과 지표 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-caption font-semibold text-ink-muted px-0.5">
            <span>이 시리즈 연재 성과</span>
            <span className="text-[11px] text-brand">
              게시된 {summary.publishedCount}개 회차 합산
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="flex flex-col gap-0.5 rounded-lg bg-surface-card border border-border/60 p-2 shadow-2xs">
              <span className="text-[10px] text-ink-muted">누적 도달</span>
              <span className="text-body-sm font-bold text-ink tabular-nums">
                {summary.totalReach > 0 ? formatCompactNumber(summary.totalReach) : "집계 중"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg bg-surface-card border border-border/60 p-2 shadow-2xs">
              <span className="text-[10px] text-ink-muted">게시물 저장</span>
              <span className="text-body-sm font-bold text-ink tabular-nums">
                {summary.totalSaves > 0 ? `${summary.totalSaves.toLocaleString()}회` : "0회"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg bg-surface-card border border-border/60 p-2 shadow-2xs">
              <span className="text-[10px] text-ink-muted">평균 반응률</span>
              <span className="text-body-sm font-bold text-brand tabular-nums">
                {summary.avgEngagementRate > 0 ? `${summary.avgEngagementRate}%` : "0%"}
              </span>
            </div>
          </div>
        </div>

        {/* 시리즈 맞춤형 AI 소재 추천 */}
        <div className="flex flex-col gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <div className="flex items-center justify-between text-caption font-bold text-amber-800">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>{summary.aiRecommendation.title}</span>
            </div>
            <span className="text-[10px] rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-800 font-semibold">
              {summary.aiRecommendation.badge}
            </span>
          </div>
          <p className="text-[11px] text-amber-950 leading-relaxed">
            {summary.aiRecommendation.description}
          </p>
        </div>

        {/* 방안 B: Free 이용자를 위한 Pro 업그레이드 안내 */}
        {!isProOrAbove && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-pink-500/20 bg-pink-500/5 p-2.5 text-[11px]">
            <div className="flex items-center justify-between font-semibold text-pink-900">
              <span className="flex items-center gap-1">
                <Lock className="size-3 text-pink-500" />
                1-Click 피드 발행 & 자동 예약 발행
              </span>
              <span className="text-[10px] text-pink-600 bg-pink-500/10 px-1 rounded font-bold">Pro</span>
            </div>
            <p className="text-ink-muted text-[10px] leading-tight">
              Pro 플랜으로 업그레이드하시면 원클릭 즉시 게재와 정밀 AI 반응 분석이 완전히 열려요.
            </p>
            <Link
              href="/settings?tab=3"
              className="text-[10px] font-bold text-pink-600 hover:underline pt-0.5"
            >
              Pro 플랜 알아보기 ↗
            </Link>
          </div>
        )}

        {/* 제어 바 & 대시보드 바로가기 */}
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={handleRefresh}
              className="flex items-center gap-1 text-ink-muted hover:text-ink cursor-pointer transition-colors"
            >
              <RefreshCw className={cn("size-3", pending && "animate-spin")} />
              <span>새로고침</span>
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleDisconnect}
              className="flex items-center gap-1 text-ink-muted hover:text-danger cursor-pointer transition-colors"
            >
              <Unlink className="size-3" />
              <span>연결 해제</span>
            </button>
          </div>
          <Link
            href="/settings?tab=1"
            className="flex items-center gap-0.5 font-semibold text-brand hover:underline"
          >
            <span>전체 대시보드</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    );
  }

  // Not Connected State
  return (
    <>
      <div className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-dashed border-border-control p-5 lg:w-88 bg-surface-card/60">
        {notice && (
          <div className="flex items-center gap-2 rounded-lg bg-brand-tint px-3 py-1.5 text-caption font-semibold text-brand">
            <CheckCircle2 className="size-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-surface-sunken text-ink-muted">
            <InstagramIcon className="size-4" />
          </div>
          <h2 className="text-title font-semibold">인스타그램 성과</h2>
        </div>

        <p className="text-body-sm text-ink-muted leading-relaxed">
          인스타그램 크리에이터 계정을 연결하면 <strong>'{series.title}'</strong> 회차별 도달·저장 반응을 자동 수집하고, 독자 반응이 검증된 다음 화 소재를 추천해 드려요.
        </p>

        <div className="rounded-lg bg-surface-sunken/60 p-3 text-caption text-ink-muted space-y-1 border border-border/60">
          <p className="font-semibold text-ink">연동 시 제공되는 기능 (방안 B):</p>
          <p>• 회차별 썸네일 도달 수 및 저장률 성과 뱃지 표시</p>
          <p>• 1-Click 피드 즉시 발행 & 자동 예약 발행 (Pro/Max 전용)</p>
          <p>• 고성과 에피소드 기반 독자 맞춤형 다음 화 소재 제안</p>
          <p>• 마이페이지 SNS 성과 분석 및 협찬 미디어킷 자동 생성</p>
        </div>

        <div className="flex-1" />

        <Button
          variant="secondary"
          block
          onClick={() => {
            setInputUsername("");
            setOpenModal(true);
          }}
          className="gap-2 font-bold shadow-2xs hover:border-pink-500 hover:text-pink-600 transition-colors"
        >
          <InstagramIcon className="size-4 text-pink-500" />
          <span>인스타그램 계정 연결</span>
        </Button>

        <div className="text-center">
          <Link
            href="/settings?tab=0"
            className="text-[11px] text-ink-subtle hover:text-brand underline"
          >
            마이페이지에서 연동 설정 관리 ↗
          </Link>
        </div>
      </div>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="인스타그램 계정 연결"
        description="Sharktoon과 인스타그램 비즈니스/크리에이터 계정을 연동합니다."
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenModal(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={handleConnect}
              className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-bold"
            >
              Instagram으로 계속하기
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface-sunken/40 p-4">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white">
              <InstagramIcon className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-body font-bold text-ink">Instagram Graph API 연동</span>
              <span className="text-caption text-ink-muted">
                피드 발행, 게시물 인사이트(도달·저장·공유) 읽기 권한
              </span>
            </div>
          </div>

          <Field
            label="인스타그램 아이디 (@사용자명)"
            value={inputUsername}
            onChange={setInputUsername}
            placeholder="예: sharktoon_daily (미입력 시 기본 데모 계정)"
            help="비즈니스 또는 크리에이터 계정만 인사이트 조회가 가능합니다."
          />

          <div className="rounded-lg bg-surface-sunken p-3 text-caption text-ink-muted space-y-1">
            <p className="font-semibold text-ink">연동 시 유의사항:</p>
            <p>• 마이페이지와 모든 시리즈 탭에 동일하게 적용됩니다.</p>
            <p>• 실제 회차가 인스타에 올라갈 때마다 인사이트가 자동 갱신됩니다.</p>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default InstagramIntegrationCard;
