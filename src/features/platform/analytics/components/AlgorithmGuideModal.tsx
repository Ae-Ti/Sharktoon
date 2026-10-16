"use client";

import {
  TrendingUp,
  Bookmark,
  Share2,
  Heart,
  MessageCircle,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Eye,
  Award,
} from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";

export interface AlgorithmGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function AlgorithmGuideModal({ open, onClose }: AlgorithmGuideModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="인스타툰 알고리즘 & 반응률 가이드"
      description="인스타그램 피드·릴스 추천 알고리즘의 원리와 상위 1% 인스타툰의 반응률 공식을 완벽 정리해 드립니다."
      footer={
        <Button onClick={onClose} className="w-full sm:w-auto">
          이해했어요
        </Button>
      }
    >
      <div className="flex flex-col gap-5 text-ink">
        {/* 1. 인스타 알고리즘 가중치 구조 */}
        <section className="flex flex-col gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <div className="flex items-center gap-2 text-label font-bold text-indigo-700 dark:text-indigo-300">
            <Zap className="size-4 text-indigo-600" />
            <span>1. 알고리즘 상호작용 가중치 (왜 저장·공유인가?)</span>
          </div>
          <p className="text-caption text-ink-muted leading-relaxed">
            인스타그램 추천 AI는 단순 스크롤이나 ‘좋아요’보다, 유저가 콘텐츠를 소장하거나 타인에게 전달하는 행동에 압도적인 가중치를 부여합니다.
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
            <div className="flex flex-col items-center gap-1 rounded-lg bg-surface-card border border-border/60 p-2.5 text-center">
              <span className="text-caption font-bold text-ink-muted flex items-center gap-1">
                <Heart className="size-3.5 text-rose-500" /> 좋아요
              </span>
              <span className="text-title-sm font-extrabold text-ink">1x</span>
              <span className="text-[10px] text-ink-subtle">단순 선호 신호</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-surface-card border border-border/60 p-2.5 text-center">
              <span className="text-caption font-bold text-ink-muted flex items-center gap-1">
                <MessageCircle className="size-3.5 text-sky-500" /> 댓글
              </span>
              <span className="text-title-sm font-extrabold text-ink">3x</span>
              <span className="text-[10px] text-ink-subtle">커뮤니티 참여</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-surface-card border border-indigo-500/30 p-2.5 text-center ring-1 ring-indigo-500/20">
              <span className="text-caption font-bold text-indigo-600 flex items-center gap-1">
                <Bookmark className="size-3.5 text-indigo-600" /> 저장 (Save)
              </span>
              <span className="text-title-sm font-extrabold text-indigo-600">5x ⭐</span>
              <span className="text-[10px] text-indigo-700/80">소장 가치 신호</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-surface-card border border-pink-500/30 p-2.5 text-center ring-1 ring-pink-500/20">
              <span className="text-caption font-bold text-pink-600 flex items-center gap-1">
                <Share2 className="size-3.5 text-pink-600" /> DM 공유
              </span>
              <span className="text-title-sm font-extrabold text-pink-600">7x 🔥</span>
              <span className="text-[10px] text-pink-700/80">바이럴 확산 트리거</span>
            </div>
          </div>
        </section>

        {/* 2. 샥툰 반응률 계산 공식 & 벤치마크 */}
        <section className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-label font-bold text-ink">
              <TrendingUp className="size-4 text-brand" />
              <span>2. 샥툰 반응률 계산 공식 & 작가 벤치마크</span>
            </div>
            <Badge tone="brand" className="text-[10px]">표준 공식</Badge>
          </div>

          <div className="rounded-lg bg-surface-sunken/80 px-3 py-2 text-caption font-mono text-center text-ink border border-border/60">
            반응률(%) = <span className="font-bold text-brand">(좋아요 + 저장 + 공유 + 댓글)</span> ÷ <span className="font-bold">도달 수(Reach)</span> × 100
          </div>

          <div className="flex flex-col gap-2 pt-1 text-caption">
            <div className="flex items-center justify-between rounded-lg bg-surface-sunken/40 px-3 py-2 border border-border/40">
              <span className="font-medium text-ink">일반 인스타 계정 평균</span>
              <span className="font-bold text-ink-muted">2.0% ~ 3.5%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <span className="font-bold">상위 10% 우수 인스타툰 (팬덤 형성)</span>
              <span className="font-bold">4.0% ~ 6.0%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-rose-500/10 px-3 py-2 border border-rose-500/20 text-rose-800 dark:text-rose-300">
              <span className="font-bold">상위 1% 바이럴 툰 (탐색 탭 장악!)</span>
              <span className="font-extrabold">6.0% ~ 10.0%+ 🔥</span>
            </div>
          </div>

          <p className="text-[11px] text-ink-subtle">
            ※ 특히 <strong>저장률(Saves / Reach)</strong>이 <strong>2.5%</strong>를 돌파하면 알고리즘이 해당 회차를 탐색 탭(Explore Grid)의 관련 관심사 유저들에게 대규모 추천하기 시작합니다.
          </p>
        </section>

        {/* 3. 반응률 2배 높이는 3대 실전 전략 */}
        <section className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface-card p-4">
          <div className="flex items-center gap-2 text-label font-bold text-ink">
            <Sparkles className="size-4 text-amber-500" />
            <span>3. 반응률을 폭발시키는 3대 실전 연재 팁</span>
          </div>

          <div className="flex flex-col gap-2 pt-1 text-caption text-ink-muted">
            <div className="flex items-start gap-2">
              <span className="font-bold text-brand shrink-0">Tip 1.</span>
              <p>
                <strong>표지 1번 컷에 질문형 카피 & 감정 표정 배치</strong>: "다들 퇴근 직전에 이런 적 있으시죠? 😭"처럼 독자가 자신과 동일시하게 만들면 2번 컷 스와이프 확률이 80% 이상으로 올라갑니다.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-brand shrink-0">Tip 2.</span>
              <p>
                <strong>4~6컷 최적 호흡 유지</strong>: 회차가 8컷을 넘어가면 후반부 이탈률이 급격히 증가합니다. 4~6컷의 빠른 호흡으로 완독률(Carousel Completion Rate)을 극대화하세요.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-brand shrink-0">Tip 3.</span>
              <p>
                <strong>마지막 컷 명확한 저장·공유 유도</strong>: 마지막 컷에 "나중에 꿀팁 다시 보려면 저장 🔖", "내 친구 닮았으면 태그하기 @" 안내를 한 줄 넣는 것만으로 저장률이 평균 +35% 증가합니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
