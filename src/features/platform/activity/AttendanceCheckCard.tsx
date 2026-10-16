"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Gift, Sparkles, Flame } from "lucide-react";
import { Button } from "@/components/ui";
import { checkInAction } from "@/features/platform/actions";
import { cn } from "@/lib/cn";
import type { AttendanceState, CreditPolicy } from "../data/types";

export interface AttendanceCheckCardProps {
  attendance: AttendanceState;
  policy: CreditPolicy;
  onCheckedIn?: (result: { streak: number; granted: number; balance?: number }) => void;
}

export function AttendanceCheckCard({
  attendance,
  policy,
  onCheckedIn,
}: AttendanceCheckCardProps) {
  const [checked, setChecked] = useState(attendance.checkedInToday);
  const [streak, setStreak] = useState(attendance.streak);
  const [pending, startTransition] = useTransition();
  const [grantedAmount, setGrantedAmount] = useState<number | null>(null);

  const daysToNextBonus = policy.attendanceStreakDays - (streak % policy.attendanceStreakDays);

  function handleCheckIn() {
    if (checked) return;
    startTransition(async () => {
      const res = await checkInAction();
      if (res.ok) {
        setChecked(true);
        setStreak(res.streak);
        setGrantedAmount(res.granted);
        onCheckedIn?.(res);
      }
    });
  }

  // 7-day roadmap
  const cycleDay = ((streak - 1) % 7) + 1; // 1 to 7

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-tint text-brand shadow-2xs">
            <Flame className="size-5 fill-brand/20 stroke-[2.5]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-title font-bold text-ink">
                연속 {streak}일 출석!
              </h3>
              {checked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  오늘 완료
                </span>
              )}
            </div>
            <p className="text-[12px] text-ink-muted">
              {checked
                ? `내일 출석하면 연속 ${streak + 1}일째가 돼요.`
                : daysToNextBonus === policy.attendanceStreakDays
                ? "오늘 출석 체크하고 크레딧을 받아가세요!"
                : `${daysToNextBonus}일 더 출석하면 +${policy.attendanceStreakBonus}C 보너스 지급!`}
            </p>
          </div>
        </div>

        <Button
          variant={checked ? "secondary" : "cta"}
          size="md"
          loading={pending}
          disabled={checked}
          onClick={handleCheckIn}
          className="font-bold shrink-0 min-w-[120px]"
        >
          {checked ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4" />
              출석 완료
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-4" />
              오늘 출석하기
            </span>
          )}
        </Button>
      </div>

      {grantedAmount !== null && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-caption text-emerald-700 dark:text-emerald-300">
          <Gift className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            +{grantedAmount} 크레딧 지급 완료! (연속 {streak}일 달성 🎉)
          </span>
        </div>
      )}

      {/* 7일 연속 출석 로드맵 트래커 */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted">
          <span>7일 출석 보너스 로드맵</span>
          <span className="font-bold text-brand">
            7일차 달성 시 +{policy.attendanceStreakBonus}C 추가
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
            const isCompleted = checked ? dayNum <= cycleDay : dayNum < cycleDay;
            const isCurrent = checked ? dayNum === cycleDay : dayNum === cycleDay;
            const isBonusDay = dayNum === 7;

            return (
              <div
                key={dayNum}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-all",
                  isCompleted
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : isCurrent
                    ? "border-brand bg-brand-tint/40 text-brand ring-2 ring-brand/30"
                    : "border-border/60 bg-surface-sunken/40 text-ink-muted"
                )}
              >
                <span className="text-[10px] font-semibold">{dayNum}일차</span>
                <span className="text-caption font-bold">
                  {isBonusDay ? `+${policy.attendanceDaily + policy.attendanceStreakBonus}C` : `+${policy.attendanceDaily}C`}
                </span>
                {isCompleted && (
                  <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
