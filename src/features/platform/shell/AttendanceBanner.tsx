"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { checkInAction } from "@/features/platform/actions";

export interface AttendanceBannerProps {
  checkedInToday: boolean;
  streak: number;
}

/** 출석은 하루 1크레딧, 7일 연속이면 3크레딧을 더 준다. */
export function AttendanceBanner({ checkedInToday, streak }: AttendanceBannerProps) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [done, setDone] = useState(checkedInToday);

  const toNext = 7 - (streak % 7);

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-accent-tint px-5 py-4">
      <div className="flex flex-col gap-1">
        <span className="text-body font-semibold text-accent-ink">
          {result ??
            (done
              ? `출석 ${streak}일째 · 오늘 크레딧을 받았어요`
              : toNext === 1
                ? `출석 ${streak}일째 · 오늘 받으면 보너스 3크레딧`
                : `출석 ${streak}일째 · ${toNext}일 더 모으면 보너스 3크레딧`)}
        </span>
        <span className="text-body-sm text-accent-ink">
          하루 1크레딧, 7일 연속이면 3크레딧을 더 드려요.
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
              setResult(`${r.granted}크레딧을 받았어요 · ${r.streak}일 연속`);
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
