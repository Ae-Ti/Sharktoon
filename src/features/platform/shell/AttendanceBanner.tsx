"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { checkInAction } from "@/features/platform/actions";
import type { CreditPolicy } from "@/features/platform/data/types";

export interface AttendanceBannerProps {
  checkedInToday: boolean;
  streak: number;
  /** 출석 보상량은 운영하며 바꾼다(credit_policy). 문구가 그 값을 그대로 보여준다. */
  policy: CreditPolicy;
}

export function AttendanceBanner({ checkedInToday, streak, policy }: AttendanceBannerProps) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [done, setDone] = useState(checkedInToday);

  const days = policy.attendanceStreakDays;
  const toNext = days - (streak % days);
  const bonus = policy.attendanceStreakBonus;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-accent-tint px-5 py-4">
      <div className="flex flex-col gap-1">
        <span className="text-body font-semibold text-accent-ink">
          {result ??
            (done
              ? `출석 ${streak}일째 · 오늘 크레딧을 받았어요`
              : toNext === 1
                ? `출석 ${streak}일째 · 오늘 받으면 보너스 ${bonus}크레딧`
                : `출석 ${streak}일째 · ${toNext}일 더 모으면 보너스 ${bonus}크레딧`)}
        </span>
        <span className="text-body-sm text-accent-ink">
          하루 {policy.attendanceDaily}크레딧, {days}일 연속이면 {bonus}크레딧을 더 드려요. 한 달에{" "}
          {policy.attendanceMonthlyCap}크레딧까지 받을 수 있어요.
        </span>
      </div>

      <Button
        variant="secondary"
        disabled={done}
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await checkInAction();
            if (r.ok) {
              setDone(true);
              setResult(
                r.granted > 0
                  ? `${r.granted}크레딧을 받았어요 · ${r.streak}일 연속`
                  : `${r.streak}일 연속 출석 · 이번 달 출석 크레딧은 다 받았어요`,
              );
            } else {
              setResult(r.message);
            }
          })
        }
      >
        {done ? "오늘 받음" : "오늘 크레딧 받기"}
      </Button>
    </section>
  );
}
