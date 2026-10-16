"use client";

import { useState } from "react";
import {
  Calendar,
  Sparkles,
  BookOpen,
  Coins,
  Share2,
  Filter,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { UserActivityItem, UserActivityType } from "../data/types";

export interface ActivityHistoryListProps {
  activities: UserActivityItem[];
  selectedDate?: string | null;
  onClearDateFilter?: () => void;
}

const TYPE_CONFIG: Record<
  UserActivityType,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: "brand" | "neutral" | "success" | "warning" }
> = {
  attendance: { label: "출석", icon: CheckCircle2, tone: "success" },
  generation: { label: "이미지 생성", icon: Sparkles, tone: "brand" },
  series: { label: "작품", icon: BookOpen, tone: "neutral" },
  credit: { label: "크레딧", icon: Coins, tone: "warning" },
  instagram: { label: "인스타그램", icon: Share2, tone: "brand" },
  publish: { label: "발행", icon: Share2, tone: "success" },
  share: { label: "공유", icon: Share2, tone: "brand" },
};

const INITIAL_LIMIT = 5;

export function ActivityHistoryList({
  activities,
  selectedDate,
  onClearDateFilter,
}: ActivityHistoryListProps) {
  const [filterType, setFilterType] = useState<UserActivityType | "all">("all");
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_LIMIT);

  const filtered = activities.filter((act) => {
    if (selectedDate && act.date !== selectedDate) return false;
    if (filterType !== "all" && act.type !== filterType) return false;
    return true;
  });

  const displayed = filtered.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-surface-sunken text-ink">
            <Clock className="size-4" />
          </span>
          <div>
            <h3 className="text-body font-bold text-ink">활동 및 사용 내역</h3>
            <p className="text-[12px] text-ink-muted">
              {selectedDate ? `${selectedDate} 활동 내역` : "최근 출석, 생성, 크레딧 사용 내역"}
            </p>
          </div>
        </div>

        {/* 필터 칩 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "attendance", "generation", "series", "credit"] as const).map((t) => {
            const isSelected = filterType === t;
            const label =
              t === "all"
                ? "전체"
                : t === "attendance"
                ? "출석"
                : t === "generation"
                ? "생성"
                : t === "series"
                ? "작품"
                : "크레딧";

            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setFilterType(t);
                  setVisibleCount(INITIAL_LIMIT);
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                  isSelected
                    ? "bg-brand text-on-brand shadow-2xs"
                    : "border border-border/80 bg-surface-sunken/40 text-ink-muted hover:text-ink hover:border-border-control"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="flex items-center justify-between rounded-lg bg-brand-tint/30 border border-brand/20 px-3 py-1.5 text-[12px] text-brand font-medium">
          <span>{selectedDate} 필터가 적용되어 있습니다 ({filtered.length}건)</span>
          <button
            type="button"
            onClick={onClearDateFilter}
            className="hover:underline cursor-pointer font-bold"
          >
            전체 보기 ✕
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-caption text-ink-muted">
          해당 조건의 활동 내역이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {displayed.map((item) => {
            const conf = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.attendance;
            const Icon = conf.icon;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between py-3 gap-3 first:pt-1 last:pb-1"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg shadow-2xs",
                      item.type === "attendance"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : item.type === "generation"
                        ? "bg-brand-tint text-brand"
                        : item.type === "credit"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-surface-sunken text-ink-muted"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-body-sm font-semibold text-ink truncate">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-ink-muted truncate">
                      {item.description}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 gap-0.5">
                  {item.creditDelta != null && (
                    <span
                      className={cn(
                        "text-caption font-bold",
                        item.creditDelta > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : item.creditDelta < 0
                          ? "text-danger"
                          : "text-ink-muted"
                      )}
                    >
                      {item.creditDelta > 0 ? `+${item.creditDelta}` : item.creditDelta} C
                    </span>
                  )}
                  <span className="text-[10px] text-ink-subtle">
                    {item.date} {item.time}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 하단 사용 내역 더보기 버튼 */}
      {filtered.length > visibleCount && (
        <div className="pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 10)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-surface-sunken/40 py-2.5 text-caption font-bold text-ink-muted hover:text-ink hover:bg-surface-sunken hover:border-border transition-all cursor-pointer"
          >
            <span>사용 내역 더보기 ({filtered.length - visibleCount}개 남음)</span>
            <ChevronDown className="size-3.5" />
          </button>
        </div>
      )}

      {visibleCount > INITIAL_LIMIT && filtered.length <= visibleCount && (
        <div className="pt-2 border-t border-border/60 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount(INITIAL_LIMIT)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-subtle hover:text-ink cursor-pointer"
          >
            <span>내역 접기</span>
            <ChevronUp className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
