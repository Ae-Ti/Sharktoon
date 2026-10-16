"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Bookmark,
  Share2,
  Eye,
  Sparkles,
  ExternalLink,
  ArrowUpRight,
  Flame,
  Award,
  ChevronRight,
  BookOpen,
  Lock,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { SnsAnalyticsData } from "../types";
import { AlgorithmGuideModal } from "./AlgorithmGuideModal";

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

export interface SnsAnalyticsDashboardProps {
  initialData?: SnsAnalyticsData;
  data?: SnsAnalyticsData;
  onGoToSettings?: (tabIndex: number) => void;
  /** AI 독자 반응 피드백은 Pro 부터. 무료는 잠금 안내만 보인다. */
  canUseAiFeedback?: boolean;
}

export function SnsAnalyticsDashboard({
  initialData,
  data: controlledData,
  onGoToSettings,
  canUseAiFeedback = false,
}: SnsAnalyticsDashboardProps) {
  const [internalData, setInternalData] = useState<SnsAnalyticsData>(
    controlledData ?? initialData!
  );

  useEffect(() => {
    if (controlledData) {
      setInternalData(controlledData);
    }
  }, [controlledData]);

  const activeData = controlledData ?? internalData;
  const [openGuide, setOpenGuide] = useState(false);

  const account = activeData.account;
  const overview = activeData.overview;

  const maxReach = Math.max(...(activeData.trends.map((t) => t.reach) || [1]), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* 미연동 안내. 연동된 계정 정보·동기화는 SNS 연동 탭에 있다 */}
      {!account.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-500/30 bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-transparent p-4 text-body-sm shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-2xs">
              <InstagramIcon className="size-4" />
            </div>
            <div>
              <p className="text-body-sm font-bold text-ink">
                인스타그램 계정이 미연동 상태입니다
              </p>
              <p className="text-caption text-ink-muted">
                마이페이지에서 계정을 연동하면 실제 도달·저장 지표가 분석되며 AI 피드백이 더욱 정교해집니다.
              </p>
            </div>
          </div>
          {onGoToSettings && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onGoToSettings(0)}
              className="gap-1 font-semibold text-caption text-ink"
            >
              <span>마이페이지에서 연동하기</span>
              <ChevronRight className="size-3.5" />
            </Button>
          )}
        </div>
      ) : null}

      {/* 1. AI 성과 분석 및 다음 화 추천 카드 (최상단 배치). 무료는 잠금 안내 */}
      {!canUseAiFeedback ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface-card p-5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-surface-sunken text-ink-muted">
              <Lock className="size-4" />
            </span>
            <div className="flex flex-col">
              <span className="text-body-sm font-bold text-ink">AI 독자 반응 피드백 & 다음 화 추천</span>
              <span className="text-caption text-ink-muted">Pro 플랜부터 게시 성과를 분석해 다음 화 테마와 첫 컷 팁을 추천해 드려요.</span>
            </div>
          </div>
          <Link
            href="/settings?tab=3"
            className="inline-flex items-center gap-1 text-caption font-bold text-brand hover:underline"
          >
            Pro 플랜 알아보기 ↗
          </Link>
        </section>
      ) : (
      <section className="relative overflow-hidden rounded-2xl border border-brand/40 bg-gradient-to-br from-brand-subtle/50 via-surface-card to-pink-500/5 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-brand text-on-brand shadow-xs">
              <Sparkles className="size-4" />
            </span>
            <div className="flex flex-col">
              <span className="text-caption font-bold text-brand">AI 독자 반응 피드백</span>
              <h3 className="text-body font-bold text-ink">
                {activeData.recommendation.highlight}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1 text-caption text-ink">
            <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-surface-card/90 p-3">
              <Flame className="size-4 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <span className="font-bold text-ink">추천 다음 화 테마:</span>{" "}
                <span className="text-ink-muted">{activeData.recommendation.recommendedTheme}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-surface-card/90 p-3">
              <Bookmark className="size-4 shrink-0 text-brand mt-0.5" />
              <div>
                <span className="font-bold text-ink">표지 첫 컷 팁:</span>{" "}
                <span className="text-ink-muted">{activeData.recommendation.recommendedHook}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-ink-subtle">
              💡 {activeData.recommendation.bestFormat}
            </span>
            <Link
              href="/episodes/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-caption font-bold text-on-brand shadow-2xs hover:bg-brand-hover transition-all"
            >
              <span>이 추천으로 다음 화 만들기</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* 인스타툰 알고리즘 & 반응률 가이드 배너 */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-pink-500/10 p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-2xs">
            <BookOpen className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-bold text-ink">인스타툰 알고리즘 & 반응률 가이드</span>
              <Badge tone="brand" className="text-[10px] font-bold">필독 ⚡</Badge>
            </div>
            <p className="text-caption text-ink-muted">
              단순 조회수보다 '저장·공유'가 왜 5배 더 중요한지, 상위 1% 인스타툰의 반응률 공식과 연재 팁을 확인해보세요.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpenGuide(true)}
          className="gap-1.5 font-bold text-caption text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 hover:bg-indigo-50/50 shrink-0 shadow-2xs"
        >
          <span>가이드 보기</span>
          <ExternalLink className="size-3.5" />
        </Button>
      </div>

      <AlgorithmGuideModal open={openGuide} onClose={() => setOpenGuide(false)} />

      {/* 2. 최근 30일 핵심 성과 요약 지표 카드 (Hero Metrics) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-body font-bold text-ink sm:text-title">최근 30일 핵심 성과</h2>
          <span className="text-caption text-ink-subtle">Meta Graph API 기준</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* 총 도달 */}
          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/80 bg-surface-card p-4 shadow-2xs">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-caption font-semibold">총 도달 (Reach)</span>
              <Eye className="size-4 text-sky-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-title-lg font-extrabold text-ink tabular-nums">
                {formatNumber(overview.totalReach)}
              </span>
              <span className="inline-flex items-center text-[11px] font-bold text-emerald-600">
                <ArrowUpRight className="size-3" />
                +{overview.totalReachDelta}%
              </span>
            </div>
            <span className="text-[11px] text-ink-subtle">조회한 순수 계정 수</span>
          </div>

          {/* 평균 저장 수 */}
          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/80 bg-surface-card p-4 shadow-2xs">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-caption font-semibold">회차당 평균 저장</span>
              <Bookmark className="size-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-title-lg font-extrabold text-ink tabular-nums">
                {formatNumber(overview.avgSaves)}개
              </span>
              <span className="inline-flex items-center text-[11px] font-bold text-emerald-600">
                <ArrowUpRight className="size-3" />
                +{overview.avgSavesDelta}%
              </span>
            </div>
            <span className="text-[11px] text-amber-600 font-medium">알고리즘 추천 최우선</span>
          </div>

          {/* 평균 공유 수 */}
          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/80 bg-surface-card p-4 shadow-2xs">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-caption font-semibold">회차당 평균 공유</span>
              <Share2 className="size-4 text-pink-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-title-lg font-extrabold text-ink tabular-nums">
                {formatNumber(overview.avgShares)}회
              </span>
              <span className="inline-flex items-center text-[11px] font-bold text-emerald-600">
                <ArrowUpRight className="size-3" />
                +{overview.avgSharesDelta}%
              </span>
            </div>
            <span className="text-[11px] text-ink-subtle">DM 및 스토리 바이럴</span>
          </div>

          {/* 평균 참여율 */}
          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/80 bg-surface-card p-4 shadow-2xs">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-caption font-semibold">반응률 (Engagement)</span>
              <TrendingUp className="size-4 text-brand" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-title-lg font-extrabold text-ink tabular-nums">
                {overview.engagementRate}%
              </span>
              <Badge tone="brand" className="text-[10px] font-bold">
                상위 5%
              </Badge>
            </div>
            <span className="text-[11px] text-ink-subtle">인스타 평균(1.5%) 대비 4.5배</span>
          </div>
        </div>
      </section>

      {/* 3. 최근 7일 성과 트렌드 비주얼라이저 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-brand" />
            <h3 className="text-body font-bold text-ink">일자별 도달 & 저장 추이</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-ink-muted">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-xs bg-brand" /> 도달 수
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-xs bg-amber-500" /> 저장 수
            </span>
          </div>
        </div>

        {activeData.trends && activeData.trends.length > 0 ? (
          <div className="grid grid-cols-7 gap-2 pt-4 border-t border-border/50 items-end min-h-[160px]">
            {activeData.trends.map((t) => {
              const heightPercent = Math.round((t.reach / maxReach) * 100);
              return (
                <div key={t.date} className="flex flex-col items-center gap-1.5 group">
                  <span className="text-[10px] font-semibold text-ink-subtle group-hover:text-brand transition-colors">
                    {formatNumber(t.reach)}
                  </span>
                  <div className="relative w-full max-w-[36px] flex flex-col justify-end rounded-t-lg bg-surface-sunken overflow-hidden h-28">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-gradient-to-t from-brand to-brand/70 rounded-t-sm transition-all group-hover:brightness-110"
                    />
                    <div
                      style={{ height: `${Math.round((t.saves / (maxReach * 0.1 || 1)) * 100)}%` }}
                      className="absolute bottom-0 inset-x-0 bg-amber-500/40 border-t border-amber-400"
                    />
                  </div>
                  <span className="text-[11px] font-medium text-ink-muted">{t.date}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-caption text-ink-muted">
            계정을 연동하면 일자별 추이가 여기에 표시됩니다.
          </div>
        )}
      </section>

      {/* 4. 독자 반응 최고 화 (Top Performed Episodes) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-amber-500" />
            <h3 className="text-body font-bold text-ink">독자 반응 최고 회차 (Top 3)</h3>
          </div>
          <span className="text-caption text-ink-subtle">저장률 순</span>
        </div>

        {activeData.topEpisodes && activeData.topEpisodes.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {activeData.topEpisodes.map((ep, idx) => (
              <div
                key={ep.episodeId}
                className="flex flex-col justify-between rounded-2xl border border-border/80 bg-surface-card p-4 shadow-2xs hover:border-brand/60 transition-all group"
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-caption font-extrabold text-amber-700">
                      👑 {idx + 1}위
                    </span>
                    <a
                      href={ep.instagramPostUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[11px] font-semibold text-ink-muted hover:text-brand transition-colors"
                    >
                      <span>인스타 게시물</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-caption font-semibold text-brand">
                      {ep.seriesTitle} · {ep.episodeNumber}화
                    </span>
                    <h4 className="text-body font-bold text-ink line-clamp-1 group-hover:text-brand transition-colors">
                      {ep.title}
                    </h4>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-border/60 bg-surface-sunken/40 p-2.5 text-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-ink-muted">도달</span>
                      <span className="text-caption font-bold text-ink">{formatNumber(ep.reach)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-amber-600 font-semibold">저장</span>
                      <span className="text-caption font-extrabold text-amber-700">{ep.saves}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-pink-600 font-semibold">공유</span>
                      <span className="text-caption font-bold text-pink-700">{ep.shares}</span>
                    </div>
                  </div>

                  <p className="rounded-lg bg-surface-sunken/60 px-2.5 py-1.5 text-[11px] text-ink-muted leading-tight">
                    ✨ {ep.keyInsight}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50 mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-ink-subtle">게시일: {ep.publishedAt}</span>
                  <span className="text-[11px] font-bold text-brand">저장률 {ep.saveRate}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/80 bg-surface-card p-8 text-center text-caption text-ink-muted">
            아직 집계된 회차 성과 데이터가 없습니다.
          </div>
        )}
      </section>
    </div>
  );
}
