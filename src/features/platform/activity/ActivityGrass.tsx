"use client";

import { useState } from "react";
import { Sparkles, Calendar } from "lucide-react";
import { cn } from "@/lib/cn";
import type { UserActivityItem } from "../data/types";
import { calculateGrassMatrix, type DayGrassCell } from "./grassUtils";

export interface ActivityGrassProps {
  activities: UserActivityItem[];
  onSelectDay?: (date: string | null) => void;
  selectedDate?: string | null;
}

const LEVEL_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-surface-sunken/60 hover:bg-surface-sunken border-border/40",
  1: "bg-emerald-200/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800",
  2: "bg-emerald-400 dark:bg-emerald-700 border-emerald-500",
  3: "bg-emerald-500 dark:bg-emerald-500 border-emerald-600",
  4: "bg-emerald-600 dark:bg-emerald-400 border-emerald-700",
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function ActivityGrass({
  activities,
  onSelectDay,
  selectedDate,
}: ActivityGrassProps) {
  const [hoveredCell, setHoveredCell] = useState<DayGrassCell | null>(null);

  const { weeks, totalActivities, activeDaysCount, currentStreak, longestStreak } =
    calculateGrassMatrix(activities, 16);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h3 className="text-body font-bold text-ink">연재 기록</h3>
            <p className="text-[12px] text-ink-muted">
              최근 16주간 출석 및 연재 활동 기록
            </p>
          </div>
        </div>

        {/* 요약 뱃지 */}
        <div className="flex items-center gap-3 text-caption font-medium">
          <div className="flex items-center gap-1.5 rounded-lg bg-surface-sunken/50 px-2.5 py-1">
            <span className="text-ink-muted">총 활동</span>
            <span className="font-bold text-ink">{totalActivities}회</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-surface-sunken/50 px-2.5 py-1">
            <span className="text-ink-muted">연속 활동</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {currentStreak}일
            </span>
            <span className="text-ink-subtle text-[11px]">(최고 {longestStreak}일)</span>
          </div>
        </div>
      </div>

      {/* 잔디 히트맵 그리드 */}
      <div className="relative overflow-x-auto pb-2 scrollbar-none">
        <div className="inline-flex flex-col gap-1.5 min-w-full">
          <div className="flex gap-1.5">
            {/* 요일 라벨 */}
            <div className="flex flex-col gap-1.5 pr-1 justify-between text-[10px] text-ink-muted select-none">
              <span className="h-3.5 leading-3.5">일</span>
              <span className="h-3.5 leading-3.5">화</span>
              <span className="h-3.5 leading-3.5">목</span>
              <span className="h-3.5 leading-3.5">토</span>
            </div>

            {/* 주차 컬럼들 */}
            <div className="flex gap-1.5">
              {weeks.map((week) => (
                <div key={week.weekIndex} className="flex flex-col gap-1.5">
                  {week.days.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="size-3.5 rounded-xs" />;
                    }

                    const isSelected = selectedDate === day.date;

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => onSelectDay?.(isSelected ? null : day.date)}
                        onMouseEnter={() => setHoveredCell(day)}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={cn(
                          "size-3.5 rounded-xs border transition-all cursor-pointer relative",
                          LEVEL_COLORS[day.level],
                          isSelected && "ring-2 ring-brand ring-offset-1 ring-offset-surface-card scale-125 z-10"
                        )}
                        aria-label={`${day.date}: ${day.count}개 활동`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* 범례 및 안내 툴팁 */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-ink-muted">
            <div className="flex items-center gap-1.5 min-h-[20px]">
              {hoveredCell ? (
                <span className="font-medium text-ink">
                  {hoveredCell.date} ({DAY_LABELS[hoveredCell.dayOfWeek]}):{" "}
                  {hoveredCell.count === 0 ? "활동 없음" : `${hoveredCell.count}개 활동`}
                </span>
              ) : selectedDate ? (
                <button
                  type="button"
                  onClick={() => onSelectDay?.(null)}
                  className="text-brand font-semibold hover:underline cursor-pointer"
                >
                  선택된 날짜 ({selectedDate}) 필터 해제 ✕
                </button>
              ) : (
                <span>날짜 블록을 누르면 해당 날짜 활동만 모아볼 수 있어요.</span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[10px]">
              <span>적음</span>
              <div className="flex items-center gap-1">
                <span className={cn("size-2.5 rounded-xs border", LEVEL_COLORS[0])} />
                <span className={cn("size-2.5 rounded-xs border", LEVEL_COLORS[1])} />
                <span className={cn("size-2.5 rounded-xs border", LEVEL_COLORS[2])} />
                <span className={cn("size-2.5 rounded-xs border", LEVEL_COLORS[3])} />
                <span className={cn("size-2.5 rounded-xs border", LEVEL_COLORS[4])} />
              </div>
              <span>많음</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

