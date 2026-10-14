"use client";

import { useState, useTransition } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, Gift } from "lucide-react";
import { Button } from "@/components/ui";
import { checkInAction } from "@/features/platform/actions";
import type { CreditPolicy } from "@/features/platform/data/types";
import { cn } from "@/lib/cn";

export interface AttendanceBannerProps {
  checkedInToday: boolean;
  streak: number;
  /** 출석 보상량은 운영하며 바꾼다(credit_policy). 문구가 그 값을 그대로 보여준다. */
  policy: CreditPolicy;
}

function triggerFestiveConfetti() {
  if (typeof window === "undefined") return;

  // 1단계: 중앙 폭죽
  confetti({
    particleCount: 70,
    spread: 60,
    origin: { y: 0.65 },
    colors: ["#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"],
  });

  // 2단계: 좌측 축하 캐논
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0.15, y: 0.7 },
      colors: ["#3B82F6", "#F59E0B", "#10B981", "#60A5FA"],
    });
  }, 150);

  // 3단계: 우측 축하 캐논
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 0.85, y: 0.7 },
      colors: ["#EC4899", "#8B5CF6", "#F59E0B", "#F472B6"],
    });
  }, 300);
}

export function AttendanceBanner({ checkedInToday, streak, policy }: AttendanceBannerProps) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [done, setDone] = useState(checkedInToday);
  const [claimedAmount, setClaimedAmount] = useState<number | null>(null);

  const days = policy.attendanceStreakDays;
  const toNext = days - (streak % days);
  const bonus = policy.attendanceStreakBonus;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 transition-all",
        claimedAmount != null
          ? "border-amber-400/80 bg-gradient-to-r from-amber-500/10 via-brand-tint/30 to-accent-tint ring-2 ring-amber-400/30 shadow-md"
          : "border-border/80 bg-accent-tint/60 hover:border-accent-ink/20 shadow-2xs",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-card shadow-2xs text-brand">
              <Gift className="size-4 text-brand" />
            </span>
            <span className="text-body font-bold text-accent-ink">
              {result ??
                (done
                  ? `출석 ${streak}일째 · 오늘 크레딧을 받았어요`
                  : toNext === 1
                    ? `출석 ${streak}일째 · 오늘 받으면 보너스 ${bonus}크레딧!`
                    : `출석 ${streak}일째 · ${toNext}일 더 모으면 보너스 ${bonus}크레딧`)}
            </span>

            <AnimatePresence>
              {claimedAmount != null && (
                <motion.span
                  initial={{ scale: 0, opacity: 0, y: 4 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-white shadow-xs"
                >
                  <Sparkles className="size-3 text-yellow-200" />
                  <span>+{claimedAmount} 크레딧 획득!</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <span className="text-body-sm text-accent-ink/90">
            하루 {policy.attendanceDaily}크레딧, {days}일 연속이면 {bonus}크레딧을 더 드려요. 한 달에{" "}
            {policy.attendanceMonthlyCap}크레딧까지 받을 수 있어요.
          </span>
        </div>

        <Button
          variant={done ? "secondary" : "primary"}
          disabled={done}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await checkInAction();
              if (r.ok) {
                setDone(true);
                setClaimedAmount(r.granted);
                triggerFestiveConfetti();
                setResult(
                  r.granted > 0
                    ? `${r.granted}크레딧을 받았어요 · ${r.streak}일 연속 달성! 🎉`
                    : `${r.streak}일 연속 출석 · 이번 달 출석 크레딧은 다 받았어요`,
                );
              } else {
                setResult(r.message);
              }
            })
          }
          className={cn(
            "shrink-0 h-10 px-4 font-bold shadow-xs transition-all",
            !done && "bg-brand hover:bg-brand-hover text-on-brand hover:scale-102 active:scale-98 shadow-sm",
          )}
        >
          {done ? (
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <Check className="size-4 text-emerald-600" />
              <span>오늘 받음</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-4 text-yellow-300 animate-pulse" />
              <span>오늘 크레딧 받기</span>
            </span>
          )}
        </Button>
      </div>
    </section>
  );
}
