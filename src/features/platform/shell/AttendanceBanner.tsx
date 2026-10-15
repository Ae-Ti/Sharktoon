"use client";

import { useState, useTransition } from "react";
import confetti from "canvas-confetti";
import { Sparkles, Check, Gift, Flame } from "lucide-react";
import { Button } from "@/components/ui";
import { checkInAction } from "@/features/platform/actions";
import type { CreditPolicy } from "@/features/platform/data/types";
import { cn } from "@/lib/cn";

export interface AttendanceBannerProps {
  checkedInToday: boolean;
  streak: number;
  policy: CreditPolicy;
}

function triggerFestiveConfetti() {
  if (typeof window === "undefined") return;

  confetti({
    particleCount: 60,
    spread: 60,
    origin: { y: 0.65 },
    colors: ["#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"],
  });

  setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 50,
      origin: { x: 0.2, y: 0.7 },
      colors: ["#3B82F6", "#F59E0B", "#10B981"],
    });
  }, 120);

  setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 50,
      origin: { x: 0.8, y: 0.7 },
      colors: ["#EC4899", "#8B5CF6", "#F59E0B"],
    });
  }, 240);
}

export function AttendanceBanner({ checkedInToday, streak, policy }: AttendanceBannerProps) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(checkedInToday);
  const [currentStreak, setCurrentStreak] = useState(streak);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const daysInCycle = policy.attendanceStreakDays || 7;
  const streakBonus = policy.attendanceStreakBonus || 1;
  const monthBonus = policy.attendanceMonthStreakBonus || 3;
  const dailyCredit = policy.attendanceDaily || 0.5;

  // 7일 사이클 계산
  const cycleDay = done
    ? ((currentStreak - 1) % daysInCycle) + 1
    : (currentStreak % daysInCycle) + 1;

  const toNextBonus = daysInCycle - (currentStreak % daysInCycle);

  const steps = [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const isCompleted = done ? day <= cycleDay : day < cycleDay;
    const isToday = day === cycleDay;
    const isBonusDay = day === 7;
    const reward = isBonusDay ? dailyCredit + streakBonus : dailyCredit;

    return {
      day,
      isCompleted,
      isToday,
      isBonusDay,
      reward,
    };
  });

  return (
    <section className="relative overflow-hidden rounded-2xl bg-surface-card p-5 sm:p-6 shadow-xs transition-all">
      {/* 상단 헤더: 타이틀 & 출석 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            {done ? (
              <Flame className="size-5 text-amber-500 fill-amber-500 animate-pulse" />
            ) : (
              <Gift className="size-5 text-brand" />
            )}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h3 className="text-body font-bold text-ink flex items-center gap-2">
              <span>
                {bannerNotice ??
                  (done
                    ? `오늘 출석 완료! (연속 ${currentStreak}일째 달성)`
                    : toNextBonus === 1
                      ? `오늘 출석하면 7일 연속 보너스 +${streakBonus}C!`
                      : `오늘의 출석 체크 (${toNextBonus}일 뒤 보너스 +${streakBonus}C)`)}
              </span>
            </h3>
            <p className="text-caption text-ink-muted">
              매일 +{dailyCredit}C · 7일 연속 +{streakBonus}C · 4주 연속 +{monthBonus}C 보너스
            </p>
          </div>
        </div>

        {/* 액션 버튼 */}
        <Button
          variant={done ? "secondary" : "primary"}
          disabled={done}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await checkInAction();
              if (r.ok) {
                setDone(true);
                setCurrentStreak(r.streak);
                triggerFestiveConfetti();
                setBannerNotice(
                  r.granted > 0
                    ? `+${r.granted} 크레딧 지급 완료! (연속 ${r.streak}일 달성 🎉)`
                    : `연속 ${r.streak}일 출석 완료!`,
                );
              } else {
                setBannerNotice(r.message);
              }
            })
          }
          className={cn(
            "shrink-0 h-10 px-4 font-bold transition-all rounded-xl",
            done
              ? "bg-surface-elevated text-ink-muted border-0 opacity-80 cursor-default"
              : "bg-brand hover:bg-brand-hover text-on-brand shadow-sm hover:scale-102 active:scale-98",
          )}
        >
          {done ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-emerald-600 stroke-[3]" />
              <span>오늘 완료</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-4 text-yellow-300" />
              <span>오늘 +{dailyCredit}C 받기</span>
            </span>
          )}
        </Button>
      </div>

      {/* 중단: 7일 비주얼 스텝 프로그레스 바 */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 mt-5 pt-4 border-t border-border/30">
        {steps.map((s) => {
          return (
            <div
              key={s.day}
              className={cn(
                "flex flex-col items-center justify-between rounded-xl p-2 sm:p-2.5 transition-all text-center min-h-[72px]",
                s.isCompleted
                  ? "bg-brand/10 text-brand"
                  : s.isToday && !done
                    ? "bg-amber-500/15 text-amber-700 font-bold ring-2 ring-amber-400"
                    : s.isBonusDay
                      ? "bg-amber-500/10 text-amber-600 font-semibold"
                      : "bg-surface-elevated/50 text-ink-muted",
              )}
            >
              {/* 스텝 상단 라벨 */}
              <span className="text-[11px] sm:text-xs font-medium">
                {s.isToday && !done ? (
                  <span className="text-amber-600 font-bold">오늘</span>
                ) : s.isBonusDay ? (
                  "7일차"
                ) : (
                  `${s.day}일`
                )}
              </span>

              {/* 스텝 중앙 아이콘 */}
              <div className="my-1 grid size-6 place-items-center">
                {s.isCompleted ? (
                  <div className="grid size-5 place-items-center rounded-full bg-brand text-white">
                    <Check className="size-3.5 stroke-[3]" />
                  </div>
                ) : s.isBonusDay ? (
                  <Gift className="size-4.5 text-amber-500 animate-bounce" />
                ) : s.isToday && !done ? (
                  <Sparkles className="size-4 text-amber-500 animate-pulse" />
                ) : (
                  <div className="size-2 rounded-full bg-border" />
                )}
              </div>

              {/* 스텝 하단 보상 라벨 */}
              <span
                className={cn(
                  "text-[10px] sm:text-[11px] font-bold leading-tight",
                  s.isBonusDay ? "text-amber-600" : s.isCompleted ? "text-brand" : "text-ink-subtle",
                )}
              >
                +{s.reward}C
              </span>
            </div>
          );
        })}
      </div>

      {/* 하단 서브 정보: 4주 연속 보너스 마일스톤 안내 */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-caption text-ink-muted px-1">
        <span className="flex items-center gap-1.5">
          <span className="text-amber-500">🎁</span>
          <span>
            <strong className="font-semibold text-ink">4주(28일) 연속 출석</strong> 달성 시{" "}
            <strong className="font-semibold text-amber-600">+{monthBonus}.0 크레딧</strong> 스페셜 보너스 지급!
          </span>
        </span>
        <span className="font-medium text-ink-subtle">
          누적 출석 <strong className="font-bold text-ink">{currentStreak}</strong>일
        </span>
      </div>
    </section>
  );
}
